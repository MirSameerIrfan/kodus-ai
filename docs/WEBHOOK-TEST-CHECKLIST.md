# Checklist: O Que Falta para Testar Webhook Handler

## 🔴 CRÍTICO (Bloqueia Compilação)

### 1. ❌ TypeScript rootDir Issue

**Status:** ✅ **RESOLVIDO** (removido rootDir, incluído `../../src/**/*`)

**Problema:**

- `tsconfig.json` tinha `rootDir: "./src"`
- Mas importava arquivos de `src/` (raiz do projeto)
- TypeScript reclamava que arquivos não estavam sob rootDir

**Solução Aplicada:**

- Removido `rootDir` do `tsconfig.json`
- Adicionado `../../src/**/*` no `include`

---

### 2. ❌ IWorkflowJob Interface Inconsistente

**Status:** ❌ **PENDENTE**

**Problema:**

- `IWorkflowJob` usa `organizationAndTeam?: OrganizationAndTeamData`
- Mas código ainda usa `organizationId` e `teamId` (não existem mais)
- `WorkflowJobRepository.create()` espera `job.organizationId`
- `RabbitMQJobQueueService.enqueue()` espera `job.organizationId` e `job.teamId`
- `EnqueueWebhookUseCase` não passa `organizationAndTeam`

**Erros de Compilação:**

```
- Property 'organizationId' does not exist on type 'Omit<IWorkflowJob, ...>'
- Property 'teamId' does not exist on type 'Omit<IWorkflowJob, ...>'
```

**Solução Necessária:**

- [ ] Decidir: usar `organizationAndTeam` OU `organizationId` + `teamId`
- [ ] Atualizar `IWorkflowJob` interface (se necessário)
- [ ] Atualizar `WorkflowJobRepository` para usar interface correta
- [ ] Atualizar `RabbitMQJobQueueService` para usar interface correta
- [ ] Atualizar `EnqueueWebhookUseCase` para passar `organizationAndTeam` (ou `organizationId` + `teamId`)

**Opções:**

1. **Opção A:** Usar `organizationAndTeam` (interface atual)
    - Atualizar todo código para usar `organizationAndTeam`
    - `EnqueueWebhookUseCase` passa `organizationAndTeam: undefined` (worker identifica depois)

2. **Opção B:** Voltar para `organizationId` + `teamId` (código atual)
    - Atualizar `IWorkflowJob` para ter `organizationId` e `teamId`
    - `EnqueueWebhookUseCase` passa `organizationId: ''` (worker identifica depois)

**Recomendação:** Opção B (mais simples, menos mudanças)

---

### 3. ❌ Outros Erros de Compilação

**Status:** ❌ **PENDENTE**

**Erros Encontrados:**

- `enqueue-code-review-job.use-case.ts`: `organizationId` não existe
- `workflow-job.repository.ts`: `organizationId` e `teamId` não existem
- `rabbitmq-job-queue.service.ts`: `organizationId` e `teamId` não existem
- `get-job-status.use-case.ts`: Tipo `ICodeReviewJob` vs `IWorkflowJob`
- `ast-event-handler.service.ts`: `filter` não existe no tipo retornado
- `code-review-job-processor.service.ts`: `WorkflowPausedError` não encontrado
- `workflow-resumed-consumer.service.ts`: Métodos não existem em `ObservabilityService` e `TransactionalInboxService`
- `workflow-queue.controller.ts`: `ResourceType.CodeReview` não existe

**Solução:**

- [ ] Corrigir todos os erros relacionados a `organizationId`/`teamId` vs `organizationAndTeam`
- [ ] Corrigir outros erros de tipos

---

## 🟡 IMPORTANTE (Pode Funcionar mas com Problemas)

### 4. ⚠️ ObservabilityService e DataSource

**Status:** ✅ **OK** (disponíveis via LogModule e DatabaseModule)

**Verificação:**

- `ObservabilityService` está disponível via `LogModule` (@Global) ✅
- `DataSource` está disponível via `DatabaseModule` ✅

---

### 5. ⚠️ organizationId/teamId no EnqueueWebhookUseCase

**Status:** ❌ **PENDENTE**

**Problema:**

- `EnqueueWebhookUseCase` não passa `organizationId` ou `organizationAndTeam`
- `WorkflowJobRepository` precisa de `organizationId` obrigatório
- Banco pode não aceitar string vazia ou null

**Solução:**

- [ ] Passar `organizationId: ''` temporariamente (worker identifica depois)
- OU tornar `organizationId` opcional no repositório
- OU identificar `organizationId` do payload antes de enfileirar

---

## 🟢 BAIXA PRIORIDADE (Melhorias)

### 6. ⚠️ OutboxRelayService no Webhook Handler

**Status:** ⏸️ **PENDENTE** (documentado em WEBHOOK-PENDING-TASKS.md)

**Problema:**

- `OutboxRelayService` não está no webhook handler
- Mensagens ficam pendentes até worker processar

**Impacto:**

- Delay de até 1 segundo até publicação na fila
- Não é crítico, mas pode ser otimizado

---

## 📋 RESUMO

### ✅ Pronto:

- TypeScript rootDir ajustado
- ObservabilityService e DataSource disponíveis

### ❌ Falta:

1. **Corrigir interface IWorkflowJob** (organizationId vs organizationAndTeam)
2. **Atualizar EnqueueWebhookUseCase** para passar organizationId
3. **Corrigir todos os erros de compilação** relacionados

### ⏸️ Depois:

- OutboxRelayService no webhook handler
- Retry no controller
- Validação de organizationId

---

## 🎯 PRÓXIMOS PASSOS

1. **Decidir interface correta** (organizationId + teamId OU organizationAndTeam)
2. **Atualizar código** para usar interface correta
3. **Corrigir erros de compilação**
4. **Testar build:** `yarn build:webhooks`
5. **Testar execução:** `yarn start:webhooks`
