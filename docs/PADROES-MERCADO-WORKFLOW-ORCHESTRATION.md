# Padrões de Mercado: Workflow Orchestration para Pipelines com Serviços Externos

**Data**: 2025-01-27  
**Perspectiva**: CTO Sênior - Análise de Padrões de Mercado  
**Objetivo**: Documentar padrões de mercado para workflow orchestration quando stages dependem de serviços externos

---

## 🎯 Padrões de Mercado Identificados

### 1. Temporal (Uber) - Workflow + Activities Pattern

**Padrão**: Workflow Orchestration com Activities Assíncronas

**Como Funciona**:

- **Workflow**: Orquestra o fluxo, mantém estado, gerencia retry
- **Activity**: Executa trabalho real (pode ser externo, pode demorar)
- **External Signal**: Workflow pode pausar e esperar evento externo

**Exemplo Temporal**:

```typescript
// Workflow (orquestração)
export async function codeReviewWorkflow(
    prData: PRData,
): Promise<ReviewResult> {
    // Stage leve: validações
    const validation = await validatePR(prData);

    // Stage pesado: análise AST (activity assíncrona)
    const astTaskId = await startASTAnalysis(prData);

    // Workflow PAUSA e espera evento externo
    await condition(() => astCompleted, '1h'); // timeout 1h

    // Continua após evento
    const astResult = await getASTResult(astTaskId);

    // Stage pesado: análise LLM (activity assíncrona)
    const llmResult = await analyzeWithLLM(prData, astResult);

    // Stage leve: criar comentários
    return await createComments(llmResult);
}
```

**Características**:

- ✅ Workflow não bloqueia (pausa, espera evento)
- ✅ Activities podem ser executadas em workers diferentes
- ✅ Retry automático por activity
- ✅ Timeout configurável por etapa
- ✅ Estado persistido (workflow pode ser retomado)

**Quando Usar**:

- Workflows longos (> 5min)
- Dependências de serviços externos
- Precisa retry granular por etapa
- Precisa pausar/resumir

**Empresas que Usam**: Uber, Netflix, Coinbase, Datadog

---

### 2. AWS Step Functions - State Machine + Task Token Pattern

**Padrão**: State Machine com Wait for Callback

**Como Funciona**:

- **State Machine**: Define estados e transições
- **Task Token**: Token único para callback externo
- **Wait for Callback**: State pausa, espera callback com token

**Exemplo Step Functions**:

```json
{
    "StartAt": "ValidatePR",
    "States": {
        "ValidatePR": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:validate-pr",
            "Next": "StartASTAnalysis"
        },
        "StartASTAnalysis": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:start-ast",
            "Next": "WaitForAST"
        },
        "WaitForAST": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
            "Parameters": {
                "FunctionName": "wait-for-ast-callback",
                "TaskToken.$": "$$.Task.Token"
            },
            "Next": "AnalyzeWithLLM",
            "TimeoutSeconds": 3600
        },
        "AnalyzeWithLLM": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:analyze-llm",
            "Next": "CreateComments"
        },
        "CreateComments": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:create-comments",
            "End": true
        }
    }
}
```

**Callback Pattern**:

```typescript
// Serviço externo completa análise AST
await stepFunctions.sendTaskSuccess({
    taskToken: token, // token recebido no início
    output: JSON.stringify(astResult),
});
```

**Características**:

- ✅ State machine visual (fácil entender fluxo)
- ✅ Task token para callback seguro
- ✅ Timeout configurável por state
- ✅ Retry automático por state
- ✅ Integração nativa com AWS services

**Quando Usar**:

- Infraestrutura AWS
- Precisa visualização do fluxo
- Integração com serviços AWS

**Empresas que Usam**: Airbnb, Netflix, Capital One

---

### 3. Camunda/Zeebe - BPMN Workflow Engine Pattern

**Padrão**: BPMN (Business Process Model and Notation) com Service Tasks

**Como Funciona**:

- **BPMN**: Modelo visual de processo (XML/JSON)
- **Service Task**: Tarefa que chama serviço externo
- **Message Event**: Evento para pausar/retomar workflow

**Exemplo BPMN**:

```xml
<process id="codeReviewProcess">
  <startEvent id="start" />

  <serviceTask id="validatePR" name="Validate PR" />

  <serviceTask id="startAST" name="Start AST Analysis" />

  <intermediateCatchEvent id="waitForAST">
    <messageEventDefinition messageRef="astCompleted" />
  </intermediateCatchEvent>

  <serviceTask id="analyzeLLM" name="Analyze with LLM" />

  <serviceTask id="createComments" name="Create Comments" />

  <endEvent id="end" />
</process>
```

**Características**:

- ✅ Padrão BPMN (padrão de mercado)
- ✅ Modelo visual de processo
- ✅ Service tasks para serviços externos
- ✅ Message events para pausar/retomar
- ✅ Human tasks (para aprovações manuais)

**Quando Usar**:

- Processos de negócio complexos
- Precisa modelo visual
- Precisa human tasks
- Padrão BPMN é requisito

**Empresas que Usam**: Zalando, ING Bank, Lufthansa

---

### 4. Saga Pattern - Choreography vs Orchestration

**Padrão**: Coordenação distribuída de múltiplas etapas

#### 4.1 Choreography (Orquestração Distribuída)

**Como Funciona**:

- Cada serviço publica eventos quando completa
- Próximo serviço reage ao evento
- Não há orquestrador central

**Exemplo**:

```
WebhookHandler → publica "pr.received"
  ↓
PRValidator → consome "pr.received" → publica "pr.validated"
  ↓
ASTService → consome "pr.validated" → publica "ast.completed"
  ↓
LLMService → consome "ast.completed" → publica "llm.completed"
  ↓
CommentService → consome "llm.completed" → publica "comments.created"
```

**Características**:

- ✅ Desacoplamento total
- ✅ Escalabilidade independente
- ❌ Difícil rastrear fluxo completo
- ❌ Difícil rollback em caso de erro

**Quando Usar**:

- Serviços totalmente independentes
- Não precisa rastreamento centralizado
- Tolerância a eventual consistency

---

#### 4.2 Orchestration (Orquestração Centralizada)

**Como Funciona**:

- Orquestrador central coordena todas as etapas
- Orquestrador chama serviços e espera resposta
- Orquestrador gerencia estado e retry

**Exemplo**:

```
Orchestrator:
  1. Chama PRValidator → espera resposta
  2. Chama ASTService → espera resposta (ou evento)
  3. Chama LLMService → espera resposta
  4. Chama CommentService → espera resposta
```

**Características**:

- ✅ Rastreamento centralizado
- ✅ Fácil rollback
- ✅ Controle de fluxo claro
- ⚠️ Orquestrador pode ser ponto único de falha

**Quando Usar**:

- Precisa rastreamento centralizado
- Precisa rollback coordenado
- Fluxo complexo com decisões

---

## 🏆 Recomendação: Padrão Híbrido (Temporal-like)

### Arquitetura Recomendada

**Baseado em**: Temporal Workflow Pattern + AWS Step Functions Task Token

**Conceito**:

- **Workflow Job** = Orquestração (como Temporal Workflow)
- **Stage Leve** = Executa no mesmo worker (rápido)
- **Stage Pesado/Externo** = Activity assíncrona (pausa workflow, espera evento)

---

### Implementação Proposta

#### 1. Stages Leves (Executam no Worker)

**Execução**: Sequencial no mesmo worker, rápido (< 1s cada)

```typescript
// No CodeReviewJobProcessor
async process(job: WorkflowJob): Promise<void> {
  const context = this.prepareContext(job);

  // Stages leves executam sequencialmente
  context = await this.validateNewCommitsStage.execute(context);
  context = await this.resolveConfigStage.execute(context);
  context = await this.validateConfigStage.execute(context);
  context = await this.fetchChangedFilesStage.execute(context);
  // ... outros stages leves

  // Agora precisa de stage pesado
  await this.handleHeavyStages(context, job);
}
```

---

#### 2. Stages Pesados/Externos (Event-Driven)

**Execução**: Publica evento, pausa workflow, espera callback

```typescript
async handleHeavyStages(context: Context, job: WorkflowJob): Promise<void> {
  // Stage pesado 1: AST Analysis
  if (needsAST(context)) {
    const astTaskId = await this.startASTAnalysis(context);

    // Publica evento: "ast.analysis.requested"
    await this.publishEvent({
      eventType: 'ast.analysis.requested',
      eventKey: astTaskId,
      workflowJobId: job.id,
      correlationId: job.correlationId
    });

    // PAUSA workflow (espera evento "ast.analysis.completed")
    throw new WorkflowPausedError({
      eventType: 'ast.analysis.completed',
      eventKey: astTaskId,
      timeout: '1h'
    });
  }

  // Worker é liberado aqui
  // Quando AST completa, publica evento "ast.analysis.completed"
  // ASTEventHandler retoma workflow
}

// Quando AST completa
async onASTCompleted(event: ASTCompletedEvent): Promise<void> {
  // Encontra workflow pausado esperando este evento
  const pausedJob = await this.findPausedWorkflow({
    eventType: 'ast.analysis.completed',
    eventKey: event.taskId
  });

  // Retoma workflow
  await this.resumeWorkflow(pausedJob.id, event.result);
}
```

---

#### 3. Stages que Podem Rodar em Paralelo

**Execução**: Publica múltiplos eventos, espera todos completarem

```typescript
async handleParallelStages(context: Context, job: WorkflowJob): Promise<void> {
  const prLevelTaskId = uuid();
  const filesTaskId = uuid();

  // Inicia ambos em paralelo
  await this.startPRLevelReview(context, prLevelTaskId);
  await this.startFilesReview(context, filesTaskId);

  // Publica eventos
  await this.publishEvent({
    eventType: 'pr.review.requested',
    eventKey: prLevelTaskId,
    workflowJobId: job.id
  });

  await this.publishEvent({
    eventType: 'files.review.requested',
    eventKey: filesTaskId,
    workflowJobId: job.id
  });

  // PAUSA workflow (espera AMBOS eventos)
  throw new WorkflowPausedError({
    eventTypes: ['pr.review.completed', 'files.review.completed'],
    eventKeys: [prLevelTaskId, filesTaskId],
    waitFor: 'all', // 'all' ou 'any'
    timeout: '30min'
  });
}

// Quando ambos completarem, retoma workflow
async onReviewCompleted(event: ReviewCompletedEvent): Promise<void> {
  const pausedJob = await this.findPausedWorkflow({
    eventType: event.eventType,
    eventKey: event.taskId
  });

  // Verifica se todos eventos esperados chegaram
  const allEventsReceived = await this.checkAllEventsReceived(
    pausedJob.waitingForEvents
  );

  if (allEventsReceived) {
    await this.resumeWorkflow(pausedJob.id, collectedResults);
  }
}
```

---

## 📊 Comparação de Padrões

| Padrão                    | Complexidade | Escalabilidade | Rastreabilidade | Retry Granular | Pausa/Resume |
| ------------------------- | ------------ | -------------- | --------------- | -------------- | ------------ |
| **Temporal**              | Média        | Alta           | Alta            | Sim            | Sim          |
| **Step Functions**        | Baixa        | Alta           | Alta            | Sim            | Sim          |
| **Camunda/Zeebe**         | Alta         | Média          | Alta            | Sim            | Sim          |
| **Saga Choreography**     | Alta         | Muito Alta     | Baixa           | Não            | Não          |
| **Saga Orchestration**    | Média        | Média          | Alta            | Sim            | Parcial      |
| **Híbrido (Recomendado)** | Média        | Alta           | Alta            | Sim            | Sim          |

---

## 🎯 Recomendação Final

### Padrão Híbrido (Temporal-like)

**Por quê?**

1. ✅ **Workflow não bloqueia**: Pausa quando precisa esperar serviço externo
2. ✅ **Stages leves rápidos**: Executam sequencialmente no mesmo worker
3. ✅ **Stages pesados assíncronos**: Publicam evento, pausam, esperam callback
4. ✅ **Paralelismo**: Múltiplos stages pesados podem rodar em paralelo
5. ✅ **Retry granular**: Cada stage pesado pode ter retry independente
6. ✅ **Rastreabilidade**: Workflow Job mantém estado completo
7. ✅ **Escalabilidade**: Workers podem processar diferentes stages

**Implementação**:

- Workflow Job = Orquestração (como Temporal Workflow)
- Stages leves = Executam no mesmo worker
- Stages pesados = Activities assíncronas (pausam workflow, esperam evento)
- Event Handlers = Retomam workflow quando evento chega

**Alinhado com**:

- ✅ Temporal (Uber, Netflix)
- ✅ AWS Step Functions (Airbnb, Capital One)
- ✅ Padrões de mercado para workflows longos

---

## 📚 Referências

- **Temporal**: https://temporal.io/
- **AWS Step Functions**: https://aws.amazon.com/step-functions/
- **Camunda**: https://camunda.com/
- **Zeebe**: https://zeebe.io/
- **Saga Pattern**: https://microservices.io/patterns/data/saga.html
