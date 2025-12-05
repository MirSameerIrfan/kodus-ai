# Análise do Fluxo Atual de Queue - Etapa por Etapa

**Data**: 2025-01-27  
**Objetivo**: Documentar exatamente como o fluxo está implementado atualmente antes de fazer ajustes

## 🔍 Fluxo Atual Implementado (Estado Real do Código)

### Etapa 1: Webhook Handler (App Webhook) - `apps/webhooks/src/controllers/github.controller.ts`

**O que acontece**:

1. Recebe HTTP POST `/github/webhook`
2. Validação síncrona rápida (filtra eventos não suportados)
3. **Retorna 200 OK imediatamente** (não bloqueia)
4. Em `setImmediate()` (próxima iteração do event loop):
    - Log do webhook recebido
    - Chama `webhookLogService.log()` (salva log no banco)
    - Chama `enqueueWebhookUseCase.execute()` com:
        - `platformType: PlatformType.GITHUB`
        - `event: string` (ex: "pull_request")
        - `payload: Record<string, unknown>` (payload bruto do GitHub)

**Responsabilidades**:

- ✅ Receber HTTP
- ✅ Validar signature (não mostrado no código, mas deve estar em middleware)
- ✅ Filtrar eventos não suportados
- ✅ Enfileirar payload bruto
- ❌ **NÃO salva PR no MongoDB** (não está no código atual)
- ❌ **NÃO processa payload**

---

### Etapa 2: EnqueueWebhookUseCase - `src/core/application/use-cases/webhook/enqueue-webhook.use-case.ts`

**O que acontece**:

1. Gera `correlationId` (UUID se não fornecido)
2. Chama `jobQueueService.enqueue()` com:
    - `workflowType: WorkflowType.WEBHOOK_PROCESSING`
    - `handlerType: HandlerType.WEBHOOK_RAW`
    - `payload: input.payload` (payload bruto)
    - `organizationAndTeam: undefined` (será identificado pelo worker)
    - `metadata: { platformType, event }`
    - `status: JobStatus.PENDING`
    - `priority: 0`
    - `retryCount: 0`
    - `maxRetries: 3`

**O que enfileira**:

- Tipo: `WEBHOOK_PROCESSING`
- Payload: Payload bruto do webhook (sem processamento)
- Metadata: `{ platformType, event }`

---

### Etapa 3: RabbitMQ - Fila `workflow.jobs.queue`

**Configuração atual** (`workflow-job-consumer.service.ts`):

- Exchange: `workflow.exchange`
- Routing Key: `workflow.jobs.*` (qualquer workflow type)
- Queue: `workflow.jobs.queue`
- Tipo: Quorum queue (durable)
- Dead Letter Exchange: `workflow.exchange.dlx`

**O que está na fila**:

- Jobs `WEBHOOK_PROCESSING` (enfileirados pelo webhook handler)
- Jobs `CODE_REVIEW` (se enfileirados de outro lugar)

---

### Etapa 4: WorkflowJobConsumer - `src/core/infrastructure/adapters/services/workflowQueue/workflow-job-consumer.service.ts`

**O que acontece**:

1. Consome mensagem da fila `workflow.jobs.queue`
2. Extrai `messageId` e `jobId` da mensagem
3. Extrai `correlationId` (headers → payload → properties)
4. Valida idempotência via `TransactionalInboxService`:
    - Salva `messageId` + `jobId` em transação
    - Se já existe, ignora mensagem (duplicada)
5. Chama `jobProcessor.process(jobId)`
    - `jobProcessor` é injetado via `JOB_PROCESSOR_SERVICE_TOKEN`
    - Atualmente é `CodeReviewJobProcessorService`

**Problema identificado**:

- Consumer consome **qualquer workflow type** (`workflow.jobs.*`)
- Mas `jobProcessor` é sempre `CodeReviewJobProcessorService`
- `CodeReviewJobProcessorService` só processa `CODE_REVIEW` (linha 39)
- **Não há processor para `WEBHOOK_PROCESSING`!**

---

### Etapa 5: CodeReviewJobProcessorService - `src/core/infrastructure/adapters/services/workflowQueue/code-review-job-processor.service.ts`

**O que acontece**:

1. Busca job no banco por `jobId`
2. **Valida que é CODE_REVIEW** (linha 39):
    ```typescript
    if (job.workflowType !== WorkflowType.CODE_REVIEW) {
        throw new Error(`Job ${jobId} is not a CODE_REVIEW workflow`);
    }
    ```
3. Se for `WEBHOOK_PROCESSING`, **lança erro**!
4. Processa code review:
    - Extrai payload (espera estrutura específica de CODE_REVIEW)
    - Mapeia plataforma
    - Busca organização e team
    - Executa pipeline via `CodeReviewHandlerService`

**Problema identificado**:

- Este processor **não pode processar WEBHOOK_PROCESSING**
- Jobs `WEBHOOK_PROCESSING` enfileirados pelo webhook handler **não serão processados**
- Falta um `WebhookProcessingJobProcessorService` ou similar

---

## 🚨 Inconsistências Identificadas

### Inconsistência 1: Falta Processor para WEBHOOK_PROCESSING

**Situação atual**:

- Webhook handler enfileira `WEBHOOK_PROCESSING`
- Consumer consome qualquer tipo
- Processor só processa `CODE_REVIEW`
- **Resultado**: Jobs `WEBHOOK_PROCESSING` falham com erro

**O que deveria acontecer**:

- Ter um processor específico para `WEBHOOK_PROCESSING` que:
    1. Processa payload bruto
    2. Identifica platformType
    3. Chama `ReceiveWebhookUseCase`
    4. Handler salva PR e enfileira `CODE_REVIEW`

---

### Inconsistência 2: Onde Salvar PR no MongoDB?

**Situação atual**:

- Spec diz: "Salvar PR no MongoDB apenas no webhook handler" (FR-010d1)
- Código atual: Webhook handler **NÃO salva PR** (não está no código)
- Documento `CODE-REVIEW-ARCHITECTURE-FLOW.md` diz: Handler salva PR
- Código `githubPullRequest.handler.ts` (linha 131): **Salva PR**

**O que deveria acontecer**:

- Definir claramente: webhook handler OU worker processando WEBHOOK_PROCESSING?

---

### Inconsistência 3: Fluxo de Duas Filas vs Uma Fila

**Situação atual**:

- Webhook handler enfileira `WEBHOOK_PROCESSING`
- Handler (quando processado) enfileira `CODE_REVIEW`
- Mas `WEBHOOK_PROCESSING` não é processado!

**Fluxo esperado (baseado no spec)**:

1. Webhook → Enfileira `WEBHOOK_PROCESSING`
2. Worker processa `WEBHOOK_PROCESSING` → Chama handler → Handler salva PR → Enfileira `CODE_REVIEW`
3. Worker processa `CODE_REVIEW` → Executa pipeline

**Fluxo atual (código)**:

1. Webhook → Enfileira `WEBHOOK_PROCESSING` ✅
2. Worker tenta processar `WEBHOOK_PROCESSING` → **FALHA** (processor não existe) ❌
3. Se `CODE_REVIEW` fosse enfileirado diretamente → Funcionaria ✅

---

## 📊 Resumo: O Que Está na Fila vs O Que Não Está

### O Que Está na Fila (RabbitMQ):

- ✅ `WEBHOOK_PROCESSING` - Payload bruto do webhook
- ✅ `CODE_REVIEW` - Job de code review (se enfileirado diretamente)

### O Que Não Está na Fila:

- ❌ Validação de signature (feita no webhook handler antes de enfileirar)
- ❌ Log de webhook (feito no webhook handler, salvo no banco)
- ❌ PR no MongoDB (não está sendo salvo no webhook handler atual)

### O Que Deveria Estar na Fila (mas não está sendo processado):

- ⚠️ `WEBHOOK_PROCESSING` está sendo enfileirado mas não processado

---

## 🎯 Próximos Passos para Clarificação

Antes de fazer perguntas de clarificação, preciso entender:

1. **O fluxo atual está incompleto?** Falta implementar o processor de WEBHOOK_PROCESSING?
2. **Ou o fluxo deveria ser diferente?** Webhook handler deveria enfileirar CODE_REVIEW diretamente?
3. **Onde salvar PR?** Webhook handler ou worker processando WEBHOOK_PROCESSING?
4. **Quantas filas precisamos?** Uma fila genérica ou filas separadas por workflow type?
5. **Como rotear jobs para processors corretos?** Um consumer genérico que roteia ou consumers separados?

---

## 📝 Notas Técnicas

### Consumer Atual

- `WorkflowJobConsumer` consome `workflow.jobs.*` (qualquer tipo)
- Usa `JOB_PROCESSOR_SERVICE_TOKEN` para injetar processor
- Atualmente sempre injeta `CodeReviewJobProcessorService`

### Processor Atual

- `CodeReviewJobProcessorService` só processa `CODE_REVIEW`
- Valida tipo na linha 39 e lança erro se não for CODE_REVIEW

### Use Cases Existentes

- `EnqueueWebhookUseCase` - Enfileira WEBHOOK_PROCESSING ✅
- `EnqueueCodeReviewJobUseCase` - Enfileira CODE_REVIEW (existe mas não verificado)

### Handlers Existentes

- `GitHubPullRequestHandler` - Salva PR e enfileira CODE_REVIEW (linha 131, 150)
- Mas este handler não está sendo chamado no fluxo atual!
