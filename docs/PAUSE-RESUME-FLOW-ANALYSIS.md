# Análise do Fluxo de Pause/Resume de Workflows

## 🎯 Contexto

Stages do workflow de code review dependem de serviços externos (ex: AST Analysis). Em vez de manter o worker ocupado fazendo polling, o sistema pausa o workflow e libera o worker para processar outros jobs.

## 📊 Fluxo Atual (Implementado)

### 1. **Pausar Workflow** (quando stage depende de serviço externo)

```
┌─────────────────────────────────────────────────────────────────┐
│ Code Review Job Processor                                       │
│ (Worker processando job)                                        │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage: FileReviewContextPreparation                              │
│ - Precisa de resultado AST                                      │
│ - AST task foi criado mas ainda não completou                   │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ throw WorkflowPausedError(                                      │
│   eventType: 'ast.task.completed',                              │
│   eventKey: taskId,                                             │
│   timeout: 720000ms                                             │
│ )                                                               │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ CodeReviewJobProcessor.pauseWorkflow()                           │
│                                                                  │
│ 1. Atualiza job no banco:                                       │
│    - status: WAITING_FOR_EVENT                                  │
│    - waitingForEvent: {                                         │
│        eventType: 'ast.task.completed',                         │
│        eventKey: taskId,                                        │
│        timeout: 720000,                                         │
│        pausedAt: Date                                           │
│      }                                                          │
│    - metadata.pausedContext: { filename, taskId }              │
│                                                                  │
│ 2. Worker é liberado (não fica ocupado)                        │
│ 3. Job sai da fila de processamento                            │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Estado do Sistema:                                              │
│                                                                  │
│ ✅ Worker livre para processar outros jobs                      │
│ ✅ Job em WAITING_FOR_EVENT (não ocupa fila)                   │
│ ✅ AST Service processando task em background                  │
│ ⏳ Aguardando evento 'ast.task.completed'                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2. **Serviço Externo Completa** (AST Analysis)

```
┌─────────────────────────────────────────────────────────────────┐
│ AST Service (Background)                                        │
│ - Processa análise de código                                   │
│ - Gera resultado                                                │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ ASTEventHandler.handleASTCompleted()                            │
│                                                                  │
│ 1. Recebe evento: AST task completou                            │
│ 2. Busca jobs em WAITING_FOR_EVENT com:                       │
│    - waitingForEvent.eventType = 'ast.task.completed'          │
│    - waitingForEvent.eventKey = taskId                         │
│                                                                  │
│ 3. Para cada job encontrado:                                   │
│    - resumeWorkflow(jobId, eventData)                          │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ ASTEventHandler.resumeWorkflow()                                │
│                                                                  │
│ 1. Atualiza job no banco:                                      │
│    - status: PENDING (volta para fila)                         │
│    - waitingForEvent: undefined (limpa estado)                 │
│    - metadata.astResult: resultado do AST                      │
│    - metadata.resumedAt: Date                                  │
│                                                                  │
│ 2. Publica mensagem no RabbitMQ:                               │
│    Exchange: workflow.exchange                                 │
│    Routing Key: workflow.jobs.resumed                         │
│    Payload: { jobId, eventData }                              │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ RabbitMQ: workflow.jobs.resumed.queue                          │
│ (Fila dedicada para retomar workflows)                         │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ WorkflowResumedConsumer.handleWorkflowResumed()                 │
│                                                                  │
│ 1. Valida mensagem (idempotência via inbox)                    │
│ 2. Verifica job está em WAITING_FOR_EVENT                     │
│ 3. Chama ProcessWorkflowJobUseCase.execute({ jobId })           │
│    → Job volta para fila principal                             │
│    → Worker pega job e continua processamento                  │
│    → Stage FileReviewContextPreparation recebe astResult      │
│    → Workflow continua normalmente                             │
└─────────────────────────────────────────────────────────────────┘
```

### 3. **Timeout** (se evento não chegar)

```
┌─────────────────────────────────────────────────────────────────┐
│ Cron Job / Background Service                                   │
│ (Verifica jobs em WAITING_FOR_EVENT com timeout expirado)     │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Para cada job com timeout expirado:                            │
│                                                                  │
│ 1. Atualiza job:                                               │
│    - status: FAILED                                            │
│    - error: 'Timeout waiting for external event'               │
│                                                                  │
│ 2. Opcionalmente:                                              │
│    - Envia para DLQ                                            │
│    - Notifica operadores                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 🔍 Análise da Abordagem

### ✅ Vantagens

1. **Eficiência de Recursos**
   - Worker não fica ocupado fazendo polling
   - Permite processar outros jobs enquanto espera evento externo
   - Escalabilidade melhor (mais jobs processados por worker)

2. **Separação de Responsabilidades**
   - Worker foca em processar jobs
   - Serviço externo (AST) foca em sua tarefa
   - Event handler foca em coordenar retomada

3. **Resiliência**
   - Se worker crashar, job continua em WAITING_FOR_EVENT
   - Evento pode chegar depois e retomar workflow
   - Timeout previne jobs presos indefinidamente

4. **Observabilidade**
   - Estado claro (WAITING_FOR_EVENT)
   - Metadata rastreável (pausedAt, resumedAt, eventType)
   - Logs estruturados em cada etapa

### ⚠️ Desafios/Pontos de Atenção

1. **Complexidade**
   - Múltiplos componentes envolvidos (processor, event handler, resumed consumer)
   - Necessita coordenação entre serviços
   - Mais pontos de falha

2. **Idempotência**
   - Evento pode chegar múltiplas vezes
   - Necessita validação de estado antes de retomar
   - Transactional inbox para garantir processamento único

3. **Timeout Handling**
   - Necessita mecanismo para detectar timeouts
   - Decisão: retry ou fail?
   - Notificação de operadores

4. **Event Matching**
   - Como encontrar jobs esperando por evento específico?
   - Query por `waitingForEvent.eventType` e `eventKey`
   - Performance em escala?

## 🤔 Alternativas Consideradas

### Alternativa A: Polling Ativo (Rejeitada)

```
Worker mantém job em PROCESSING e faz polling do serviço externo
```

**Problemas:**
- Worker ocupado desnecessariamente
- Escalabilidade limitada
- Timeout de worker pode matar job

### Alternativa B: Callback Direto (Rejeitada)

```
Serviço externo chama diretamente o worker quando completa
```

**Problemas:**
- Acoplamento forte entre serviços
- Worker precisa estar disponível quando callback chega
- Difícil garantir idempotência

### Alternativa C: Event-Driven com Fila Dedicada (Atual)

```
Workflow pausa, serviço externo publica evento, consumer retoma
```

**Vantagens:**
- Desacoplamento
- Escalabilidade
- Resiliência
- Observabilidade

## 📋 Perguntas de Clarificação

Antes de confirmar se essa é a melhor abordagem, precisamos clarificar:

1. **Timeout Detection**: Como detectar timeouts? Cron job periódico ou mecanismo integrado?
2. **Event Matching**: Como encontrar jobs esperando por evento? Query direta no banco ou índice?
3. **Retry Strategy**: Se timeout ocorrer, devemos retry ou falhar permanentemente?
4. **Multiple Events**: Um job pode esperar por múltiplos eventos sequenciais?
5. **Event Ordering**: Eventos precisam manter ordem ou podem chegar fora de ordem?

