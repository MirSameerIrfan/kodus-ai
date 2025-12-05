# Pendências - Webhook Handler

## 📋 Lista de Tarefas Pendentes

### 🔴 Alta Prioridade

#### 1. OutboxRelayService no Webhook Handler

**Problema:**
- `OutboxRelayService` está apenas no `WorkflowQueueModule` (worker)
- `WebhookHandlerBaseModule` não tem `OutboxRelayService`
- Mensagens ficam pendentes no outbox até o worker processar

**Impacto:**
- Webhook handler salva no outbox ✅
- Worker publica mensagens do outbox ✅
- Mas há delay até worker processar (até 1 segundo)

**Solução:**
- Adicionar `ScheduleModule` ao `WebhookHandlerBaseModule`
- Adicionar `OutboxRelayService` aos providers
- Webhook handler publica mensagens do outbox imediatamente

**Arquivos afetados:**
- `apps/webhooks/src/modules/webhook-handler-base.module.ts`
- `apps/webhooks/src/modules/webhook-enqueue.module.ts` (pode precisar exportar OutboxRelayService)

**Decisão:**
- [ ] Adicionar OutboxRelayService ao webhook handler (publicação imediata)
- [ ] Manter como está (worker publica eventualmente)

---

### 🟡 Média Prioridade

#### 2. Retry no Controller para Falhas de Transação DB

**Problema:**
- Se transação DB falhar, webhook é perdido
- Não há retry no controller
- Apenas loga erro

**Impacto:**
- Webhooks podem ser perdidos se DB estiver temporariamente indisponível

**Solução:**
- Implementar retry com backoff exponencial
- Ou usar dead letter queue
- Ou salvar em fila local antes de tentar DB

**Decisão:**
- [ ] Implementar retry no controller
- [ ] Usar dead letter queue
- [ ] Manter como está (aceitar perda de webhooks em caso de falha DB)

---

### 🟢 Baixa Prioridade

#### 3. Validação de organizationId no EnqueueWebhookUseCase

**Problema:**
- `organizationId` está como string vazia (`''`)
- Worker precisa identificar e atualizar depois

**Impacto:**
- Pode causar problemas se banco não permitir vazio
- Worker precisa fazer trabalho extra

**Solução:**
- Tornar `organizationId` opcional no `IWorkflowJob`
- Ou identificar organizationId do payload antes de enfileirar

**Decisão:**
- [ ] Tornar organizationId opcional
- [ ] Identificar organizationId no webhook handler
- [ ] Manter como está (worker identifica)

---

## 📝 Notas

- Todas as pendências são melhorias, não bloqueadores
- Sistema atual funciona, mas pode ser otimizado
- Priorizar conforme necessidade de negócio

