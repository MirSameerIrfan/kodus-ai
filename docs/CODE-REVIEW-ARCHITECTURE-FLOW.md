# Arquitetura e Fluxo de Execução do Code Review

## 🎯 Visão Geral

Este documento descreve a arquitetura completa e o fluxo de execução do code review, desde a recepção do webhook até a conclusão do pipeline com todos os seus stages.

## 📊 Fluxo Atual (Antes da Workflow Queue)

### Fluxo Síncrono (Legado)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Webhook Handler (GitHub/GitLab/Bitbucket/Azure Repos)      │
│    - Recebe evento HTTP                                         │
│    - Valida signature                                           │
│    - Extrai payload                                             │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. GitHubPullRequestHandler / GitLabPullRequestHandler / etc.   │
│    - Determina se pode processar evento                         │
│    - Salva PR no banco (SavePullRequestUseCase)                │
│    - Decide: workflow queue ou síncrono?                       │
│    - Se síncrono → chama RunCodeReviewAutomationUseCase         │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. RunCodeReviewAutomationUseCase                               │
│    - Valida se deve executar automation                         │
│    - Mapeia payload da plataforma                              │
│    - Busca team com automation ativa                           │
│    - Valida organização e licença                              │
│    - Chama AutomationCodeReviewService.run()                    │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. AutomationCodeReviewService                                  │
│    - Verifica execução ativa existente                         │
│    - Cria nova execução (AutomationExecution)                  │
│    - Chama CodeReviewHandlerService.handlePullRequest()         │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CodeReviewHandlerService                                     │
│    - Cria contexto inicial (CodeReviewPipelineContext)          │
│    - Adiciona reação START no PR                               │
│    - Obtém pipeline 'CodeReviewPipeline'                        │
│    - Executa pipeline.execute(context)                          │
│    - Trata reações finais (SUCCESS/FAILED)                      │
│    - Atualiza status da execução                                │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Pipeline Executor (CodeReviewPipeline)                       │
│    - Executa stages sequencialmente                            │
│    - Gerencia contexto entre stages                            │
│    - Trata erros e pausas (WorkflowPausedError)                │
│    - Retorna resultado final                                    │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Stages do Pipeline (Sequencial)                             │
│                                                                  │
│    a) ValidateNewCommitsStage                                   │
│       - Valida se há novos commits                              │
│                                                                  │
│    b) ResolveConfigStage                                        │
│       - Resolve configuração do code review                      │
│                                                                  │
│    c) ValidateConfigStage                                       │
│       - Valida configuração e cadência                          │
│       - Pode pausar se AUTO_PAUSE ou MANUAL                    │
│                                                                  │
│    d) FetchChangedFilesStage                                    │
│       - Busca arquivos alterados no PR                          │
│                                                                  │
│    e) LoadExternalContextStage                                  │
│       - Carrega contexto externo (MCP, etc.)                    │
│                                                                  │
│    f) FileContextGateStage                                      │
│       - Gate para preparação de contexto de arquivos            │
│                                                                  │
│    g) InitialCommentStage                                       │
│       - Adiciona comentário inicial no PR                       │
│                                                                  │
│    h) KodyFineTuningStage (EE)                                  │
│       - Aplica fine-tuning do Kody                             │
│                                                                  │
│    i) CodeAnalysisASTStage (EE)                                  │
│       - Inicia análise AST (pode pausar workflow)              │
│       - Cria task AST e espera resultado                        │
│       - ⚠️ Pode lançar WorkflowPausedError                     │
│                                                                  │
│    j) ProcessFilesPrLevelReviewStage                            │
│       - Processa review em nível de PR                         │
│                                                                  │
│    k) ProcessFilesReview                                        │
│       - Processa review de cada arquivo                        │
│       - Prepara contexto de arquivo (pode pausar)               │
│       - ⚠️ Pode lançar WorkflowPausedError                      │
│                                                                  │
│    l) CreatePrLevelCommentsStage                                │
│       - Cria comentários em nível de PR                        │
│                                                                  │
│    m) CreateFileCommentsStage                                   │
│       - Cria comentários em arquivos específicos               │
│                                                                  │
│    n) CodeAnalysisASTCleanupStage (EE)                          │
│       - Limpa recursos AST                                     │
│                                                                  │
│    o) AggregateResultsStage                                     │
│       - Agrega resultados de todos os arquivos                │
│                                                                  │
│    p) UpdateCommentsAndGenerateSummaryStage                      │
│       - Atualiza comentários e gera resumo                      │
│                                                                  │
│    q) RequestChangesOrApproveStage                               │
│       - Solicita mudanças ou aprova PR                         │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Fluxo com Workflow Queue (Novo)

### Fluxo Assíncrono (Workflow Queue)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Webhook Handler (HTTP Endpoint - Porta 3332)                 │
│    - Recebe evento HTTP (POST /github/webhook, etc.)            │
│    - Valida signature                                           │
│    - Enfileira payload bruto na fila (WEBHOOK_PROCESSING)      │
│      → Inclui platformType e event no metadata                │
│    - Retorna 200 OK imediatamente                               │
│                                                                  │
│    NOTA: Recebe HTTP diretamente, NÃO salva PR, NÃO processa   │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. RabbitMQ: workflow.jobs.webhook-processing.queue            │
│    (Fila para processar webhooks brutos)                       │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Worker: WebhookProcessingConsumer                            │
│    - Consome WEBHOOK_PROCESSING da fila                          │
│    - Valida idempotência (transactional inbox)                 │
│    - Identifica platformType (do metadata)                      │
│    - Chama ReceiveWebhookUseCase.execute()                      │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ReceiveWebhookUseCase                                        │
│    - Seleciona handler correto (githubPullRequest.handler.ts)    │
│    - Chama handler.execute()                                     │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. GitHubPullRequestHandler                                     │
│    - Busca organização e team                                   │
│    - Salva PR no MongoDB (SavePullRequestUseCase)               │
│      → Atualiza se PR já existe (novo commit)                   │
│    - Enfileira CODE_REVIEW na fila                              │
│      (EnqueueCodeReviewJobUseCase)                               │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. RabbitMQ: workflow.jobs.code-review.queue                   │
│    (Fila dedicada para code review)                            │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Worker: CodeReviewJobConsumer                               │
│    - Consome CODE_REVIEW da fila                                │
│    - Valida idempotência (transactional inbox)                 │
│    - Chama CodeReviewJobProcessorService.process()               │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. CodeReviewJobProcessorService                                │
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. CodeReviewJobProcessorService                                │
│    - Mapeia payload da plataforma                              │
│    - Busca organização e team                                  │
│    - Valida job (status, retry, etc.)                          │
│    - Verifica execução ativa (getActiveExecution)              │
│      → Deduplicação (AutomationExecution como fonte de verdade)│
│    - Cria AutomationExecution + CodeReviewExecution             │
│      (usando correlationId como uuid)                          │
│    - Sincroniza AutomationExecution.status com WorkflowJob     │
│    - Chama CodeReviewHandlerService.handlePullRequest()         │
│      (passa workflowJobId para pausar/retomar)                 │
│    - Atualiza AutomationExecution com resultado final           │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CodeReviewHandlerService                                     │
│    - Cria contexto inicial                                      │
│    - Adiciona reação START                                      │
│    - Executa pipeline.execute(context)                          │
│    - ⚠️ Pipeline pode pausar (WorkflowPausedError)              │
│    - Trata reações finais                                       │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Pipeline Executor                                            │
│    - Executa stages sequencialmente                            │
│    - Se stage lança WorkflowPausedError:                       │
│      → Job entra em WAITING_FOR_EVENT                           │
│      → Worker é liberado                                        │
│      → Aguarda evento externo                                  │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Stages (mesmos do fluxo síncrono)                            │
│    - CodeAnalysisASTStage pode pausar                           │
│    - ProcessFilesReview pode pausar                             │
│    - Outros stages executam normalmente                         │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼ (se pausou)
┌─────────────────────────────────────────────────────────────────┐
│ 8. AST Service / External Service                               │
│    - Processa tarefa em background                              │
│    - Publica evento quando completa                             │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. ASTEventHandler / Event Handler                              │
│    - Recebe evento de conclusão                                 │
│    - Busca jobs em WAITING_FOR_EVENT                            │
│    - Retoma workflow (status → PENDING)                         │
│    - Publica em workflow.jobs.resumed.queue                     │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. WorkflowResumedConsumer                                     │
│     - Consome mensagem de retomada                              │
│     - Valida idempotência                                       │
│     - Chama ProcessWorkflowJobUseCase.execute()                  │
│     - Workflow continua do ponto onde pausou                    │
└─────────────────────────────────────────────────────────────────┘
```

## 🔍 Detalhamento dos Componentes

### 1. Webhook Handler (HTTP Endpoint - App Webhook)

**Responsabilidades**:

- **Receber eventos HTTP diretamente** de plataformas (GitHub, GitLab, Bitbucket, Azure Repos)
    - Endpoints: `POST /github/webhook`, `POST /gitlab/webhook`, etc.
    - Porta: 3332
- Validar signature/token (validação síncrona rápida)
- Extrair payload bruto
- Enfileirar payload bruto na fila RabbitMQ (WorkflowType.WEBHOOK_PROCESSING)
    - Inclui `platformType` e `event` no metadata
- Retornar 200 OK imediatamente (não bloqueia)

**Arquivos**:

- `apps/webhooks/src/controllers/github.controller.ts` - `@Post('/webhook')`
- `apps/webhooks/src/controllers/gitlab.controller.ts` - `@Post('/webhook')`
- `apps/webhooks/src/controllers/bitbucket.controller.ts` - `@Post('/webhook')`
- `apps/webhooks/src/controllers/azureRepos.controller.ts` - `@Post('/webhook')`

**O que NÃO faz**:

- ❌ NÃO salva PR no MongoDB (isso é feito pelo worker)
- ❌ NÃO processa payload (isso é feito pelo worker)
- ❌ NÃO identifica plataforma (isso é feito pelo worker)
- ❌ NÃO decide qual handler usar (isso é feito pelo worker)

**IMPORTANTE**: O webhook handler é **ultra leve** - apenas recebe HTTP, valida signature e enfileira. Todo processamento pesado acontece no worker.

### 2. WebhookProcessingConsumer (Worker - App Worker)

**Responsabilidades**:

- Consumir jobs WEBHOOK_PROCESSING da fila RabbitMQ
- Validar idempotência (transactional inbox)
- Extrair platformType do metadata
- Chamar ReceiveWebhookUseCase.execute()

**Arquivo**: `src/core/infrastructure/adapters/services/workflowQueue/webhook-processing-consumer.service.ts` (a ser criado)

### 3. ReceiveWebhookUseCase (Worker - App Worker)

**Responsabilidades**:

- Identificar plataforma (GitHub, GitLab, Bitbucket, Azure Repos)
- Selecionar handler correto baseado no platformType
- Chamar handler.execute() com payload

**Arquivo**: `src/core/application/use-cases/platformIntegration/codeManagement/receiveWebhook.use-case.ts`

### 4. GitHubPullRequestHandler (Worker - App Worker)

**Responsabilidades**:

- Buscar organização e team
- **Salvar PR no MongoDB** (SavePullRequestUseCase) - atualiza se PR já existe (novo commit)
- Verificar se workflow queue está habilitado
- Se habilitado: Enfileirar CODE_REVIEW (EnqueueCodeReviewJobUseCase)
- Se desabilitado: Executar code review síncrono (legado)

**Arquivo**: `src/core/infrastructure/adapters/webhooks/github/githubPullRequest.handler.ts`

**Integração com MongoDB**:

- Salva/atualiza PR na collection do MongoDB antes de enfileirar CODE_REVIEW
- Garante que dados estejam disponíveis mesmo se job falhar
- Evita redundância e race conditions

### 5. CodeReviewJobProcessorService (Worker - App Worker)

**Responsabilidades**:

- Consumir jobs CODE_REVIEW da fila RabbitMQ
- Validar idempotência (transactional inbox)
- Mapear payload da plataforma
- Buscar organização e team
- Verificar execução ativa (getActiveExecution) - deduplicação
- Criar AutomationExecution + CodeReviewExecution
- Sincronizar AutomationExecution.status com WorkflowJob.status
- Chamar CodeReviewHandlerService.handlePullRequest()

**Arquivo**: `src/core/infrastructure/adapters/services/workflowQueue/code-review-job-processor.service.ts`

### 6. CodeReviewHandlerService (Worker - App Worker)

**Responsabilidades**:

- Criar contexto inicial do pipeline
- Adicionar reações no PR (START, SUCCESS, FAILED)
- Obter e executar pipeline
- Tratar resultados e atualizar status

**Arquivo**: `src/core/infrastructure/adapters/services/codeBase/codeReviewHandlerService.service.ts`

### 8. Pipeline Executor (Worker - App Worker)

**Responsabilidades**:

- Executar stages sequencialmente
- Gerenciar contexto entre stages
- Tratar erros e propagar WorkflowPausedError
- Retornar resultado final

**Arquivo**: `src/core/infrastructure/adapters/services/pipeline/pipeline-executor.service.ts`

### 9. Stages do Pipeline (Worker - App Worker)

**Stages Principais**:

1. **ValidateNewCommitsStage**: Valida se há novos commits
2. **ResolveConfigStage**: Resolve configuração
3. **ValidateConfigStage**: Valida configuração e cadência
4. **FetchChangedFilesStage**: Busca arquivos alterados
5. **LoadExternalContextStage**: Carrega contexto externo
6. **FileContextGateStage**: Gate para preparação de contexto
7. **InitialCommentStage**: Comentário inicial
8. **KodyFineTuningStage** (EE): Fine-tuning do Kody
9. **CodeAnalysisASTStage** (EE): Análise AST (pode pausar)
10. **ProcessFilesPrLevelReviewStage**: Review em nível PR
11. **ProcessFilesReview**: Review de arquivos (pode pausar)
12. **CreatePrLevelCommentsStage**: Comentários PR-level
13. **CreateFileCommentsStage**: Comentários file-level
14. **CodeAnalysisASTCleanupStage** (EE): Limpeza AST
15. **AggregateResultsStage**: Agregação de resultados
16. **UpdateCommentsAndGenerateSummaryStage**: Atualização e resumo
17. **RequestChangesOrApproveStage**: Solicitação de mudanças/aprovação

**Arquivos**: `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/`

## 📊 Entidades e Relacionamentos

### AutomationExecution + CodeReviewExecution

**AutomationExecution** (timeline do review):

- Gerencia status do review (IN_PROGRESS, SUCCESS, ERROR, SKIPPED)
- Usado por dashboard e histórico
- Relacionado com TeamAutomation
- Contém dados de execução (platformType, organizationAndTeamData, etc.)

**CodeReviewExecution**:

- Entrada específica de code review dentro de AutomationExecution
- Relacionado com AutomationExecution (ManyToOne)
- Contém status e mensagem do review

**Relacionamento com WorkflowJob**:

- `WorkflowJob.correlationId = AutomationExecution.uuid`
- Permite buscar AutomationExecution a partir de WorkflowJob
- Sincronização de status entre entidades

**Criação**:

- Criado no `CodeReviewJobProcessor.process()` antes de executar pipeline
- Usa `automationExecutionService.createCodeReview()` que cria ambas as entidades
- Verifica execução ativa antes de criar para deduplicação

## 🔄 Pontos de Pausa/Resume

### Stages que Podem Pausar

1. **CodeAnalysisASTStage**
    - Cria task AST
    - Lança `WorkflowPausedError('ast.task.completed', taskId)`
    - Job entra em `WAITING_FOR_EVENT`
    - Worker é liberado

2. **ProcessFilesReview** (via FileReviewContextPreparation)
    - Prepara contexto de arquivo
    - Se precisa de AST, lança `WorkflowPausedError`
    - Job entra em `WAITING_FOR_EVENT`
    - Worker é liberado

### Fluxo de Retomada

1. **AST Service completa** → publica evento
2. **ASTEventHandler** recebe evento
3. Busca jobs em `WAITING_FOR_EVENT` com `eventKey = taskId`
4. Atualiza job: `status = PENDING`, `waitingForEvent = undefined`
5. Publica em `workflow.jobs.resumed.queue`
6. **WorkflowResumedConsumer** processa
7. Chama `ProcessWorkflowJobUseCase.execute()`
8. Workflow continua do ponto onde pausou

## 📊 Comparação: Síncrono vs Assíncrono

| Aspecto              | Síncrono (Legado)                | Assíncrono (Workflow Queue)   |
| -------------------- | -------------------------------- | ----------------------------- |
| **Webhook Response** | Bloqueia até conclusão           | Retorna imediatamente         |
| **Worker Ocupado**   | Sim, durante todo processo       | Não, liberado durante pausas  |
| **Escalabilidade**   | Limitada                         | Alta (múltiplos workers)      |
| **Resiliência**      | Se worker crasha, perde trabalho | Job persiste, pode retomar    |
| **Observabilidade**  | Limitada                         | Completa (status, métricas)   |
| **Pausa/Resume**     | Não suportado                    | Suportado (WAITING_FOR_EVENT) |

## 🎯 Próximos Passos

1. Migrar completamente para workflow queue
2. Remover código síncrono legado
3. Otimizar matching de eventos (índices)
4. Implementar buffer de eventos (TTL)
5. Adicionar métricas e alertas
