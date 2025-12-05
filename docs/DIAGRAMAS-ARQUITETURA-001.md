# Diagramas de Arquitetura: 001-workflow-queue

**Data**: 2025-01-27  
**Versão**: 1.0

---

## 📊 Diagrama 1: Arquitetura Geral

```mermaid
graph TB
    subgraph "Entry Points"
        WEBHOOK[Webhook Handler<br/>Recebe eventos GitHub/GitLab/etc]
        API[API REST<br/>Endpoints públicos]
    end

    subgraph "Workflow Queue Layer"
        WPP[WebhookProcessingJobProcessor<br/>Processa webhooks]
        CRP[CodeReviewJobProcessor<br/>Processa code reviews]
        JPR[JobProcessorRouter<br/>Roteia por tipo]
    end

    subgraph "Message Queue"
        RMQ[RabbitMQ<br/>workflow.exchange]
        QUEUE1[workflow.jobs.queue<br/>Jobs principais]
        QUEUE2[workflow.jobs.resumed<br/>Jobs retomados]
        QUEUE3[workflow.events.stage.completed<br/>Eventos de stages]
    end

    subgraph "Pipeline Layer"
        PE[CodeReviewPipelineExecutor<br/>Orquestra stages]
        PSM[PipelineStateManager<br/>Gerencia estado]
    end

    subgraph "Stages"
        LIGHT[Light Stages<br/>Rápidos, síncronos]
        HEAVY[Heavy Stages<br/>Pesados, assíncronos]
    end

    subgraph "Event Handlers"
        HSEH[HeavyStageEventHandler<br/>Retoma workflows pausados]
        WRC[WorkflowResumedConsumer<br/>Processa retomadas]
    end

    subgraph "Database"
        PG[(PostgreSQL<br/>workflow_jobs)]
        MONGO[(MongoDB<br/>Pull Requests)]
    end

    WEBHOOK --> WPP
    WPP --> RMQ
    RMQ --> QUEUE1
    QUEUE1 --> JPR
    JPR --> CRP
    CRP --> PE
    PE --> PSM
    PSM --> PG
    PE --> LIGHT
    PE --> HEAVY
    HEAVY --> RMQ
    RMQ --> QUEUE3
    QUEUE3 --> HSEH
    HSEH --> RMQ
    RMQ --> QUEUE2
    QUEUE2 --> WRC
    WRC --> CRP

    style WEBHOOK fill:#e1f5ff
    style PE fill:#fff4e1
    style HEAVY fill:#ffe1f5
    style HSEH fill:#e1ffe1
    style PG fill:#ffe1f5
```

---

## 📊 Diagrama 2: Fluxo Sequencial Detalhado

```mermaid
sequenceDiagram
    autonumber
    participant GH as GitHub Webhook
    participant WH as Webhook Handler
    participant WPP as WebhookProcessingJobProcessor
    participant RMQ as RabbitMQ
    participant WJC as WorkflowJobConsumer
    participant JPR as JobProcessorRouter
    participant CRP as CodeReviewJobProcessor
    participant PE as PipelineExecutor
    participant STAGE as Stage
    participant DB as PostgreSQL
    participant HSEH as HeavyStageEventHandler

    GH->>WH: POST /webhooks/github
    WH->>WPP: process(jobId)
    WPP->>WPP: Identifica plataforma (GitHub)
    WPP->>WPP: Chama GitHubPullRequestHandler
    WPP->>DB: Salva PR no MongoDB
    WPP->>RMQ: Publica CODE_REVIEW job
    Note over RMQ: Exchange: workflow.exchange<br/>Routing: workflow.jobs.code_review

    RMQ->>WJC: Job disponível
    WJC->>JPR: process(jobId)
    JPR->>CRP: process(jobId) [CODE_REVIEW]

    CRP->>CRP: Valida job
    CRP->>CRP: Cria AutomationExecution
    CRP->>CRP: Inicializa CodeReviewPipelineContext
    CRP->>PE: execute(context, stages, jobId)

    PE->>PE: Calcula ordem de execução (topological sort)
    PE->>PSM: saveState(jobId, context)
    PSM->>DB: UPDATE workflow_jobs SET pipelineState = ...

    loop Para cada stage
        PE->>STAGE: execute(context)
        alt Light Stage
            STAGE->>STAGE: Executa lógica
            STAGE-->>PE: Contexto atualizado
            PE->>PSM: saveState(jobId, context)
        else Heavy Stage
            STAGE->>STAGE: start() - inicia trabalho
            STAGE-->>PE: Lança WorkflowPausedError
            PE->>PSM: saveState(jobId, context)
            PE-->>CRP: Propaga WorkflowPausedError
            CRP->>DB: UPDATE status = WAITING_FOR_EVENT
            Note over CRP: Worker liberado
        end
    end

    Note over STAGE: Trabalho pesado executando...

    STAGE->>RMQ: Publica evento stage.completed.*
    RMQ->>HSEH: Evento recebido
    HSEH->>DB: SELECT jobs WHERE status = WAITING_FOR_EVENT
    HSEH->>DB: Filtra por eventType + eventKey
    HSEH->>DB: UPDATE status = PENDING
    HSEH->>RMQ: Publica workflow.jobs.resumed

    RMQ->>WRC: Job retomado
    WRC->>CRP: process(jobId)
    CRP->>CRP: Detecta resume (tem pipelineState)
    CRP->>PSM: resumeFromState(jobId)
    PSM->>DB: SELECT pipelineState
    PSM-->>CRP: Contexto restaurado
    CRP->>PE: resume(context, stages, taskId)
    PE->>STAGE: getResult(context, taskId)
    PE->>STAGE: resume(context, taskId)
    PE->>PE: Continua stages restantes
    PE-->>CRP: Pipeline completo
    CRP->>DB: UPDATE status = COMPLETED
```

---

## 📊 Diagrama 3: Estrutura de Dados

```mermaid
erDiagram
    WORKFLOW_JOB ||--o{ JOB_EXECUTION_HISTORY : has
    WORKFLOW_JOB ||--o| PIPELINE_STATE : has

    WORKFLOW_JOB {
        string id PK
        string uuid
        string workflowType
        string handlerType
        string status
        jsonb payload
        jsonb metadata
        jsonb pipelineState
        jsonb waitingForEvent
        string correlationId
        int retryCount
        datetime createdAt
        datetime updatedAt
    }

    JOB_EXECUTION_HISTORY {
        string id PK
        string jobId FK
        int attemptNumber
        string status
        datetime startedAt
        datetime completedAt
        int durationMs
    }

    PIPELINE_STATE {
        string workflowJobId FK
        string currentStage
        string correlationId
        jsonb organizationAndTeamData
        jsonb repository
        jsonb pullRequest
        jsonb codeReviewConfig
        jsonb validSuggestions
        jsonb tasks
    }

    AUTOMATION_EXECUTION {
        string uuid PK
        string status
        datetime createdAt
    }

    WORKFLOW_JOB ||--o| AUTOMATION_EXECUTION : references
```

---

## 📊 Diagrama 4: Ciclo de Vida de um Job

```mermaid
stateDiagram-v2
    [*] --> PENDING: Job criado

    PENDING --> PROCESSING: Worker pega job
    PROCESSING --> PROCESSING: Executa light stages
    PROCESSING --> WAITING_FOR_EVENT: Heavy stage pausa
    PROCESSING --> COMPLETED: Pipeline completo
    PROCESSING --> FAILED: Erro não retryable
    PROCESSING --> RETRYING: Erro retryable

    WAITING_FOR_EVENT --> PENDING: Evento chega
    PENDING --> PROCESSING: Worker retoma

    RETRYING --> PENDING: Retry agendado

    FAILED --> [*]
    COMPLETED --> [*]

    note right of WAITING_FOR_EVENT
        Estado persistido em
        pipelineState
        Worker liberado
    end note

    note right of PROCESSING
        Estado salvo após
        cada stage
    end note
```

---

## 📊 Diagrama 5: Dependências entre Stages

```mermaid
graph TD
    VNC[ValidateNewCommitsStage]
    RC[ResolveConfigStage]
    VC[ValidateConfigStage]
    FCF[FetchChangedFilesStage]
    LEC[LoadExternalContextStage]
    FCG[FileContextGateStage]
    IC[InitialCommentStage]
    PRL[PRLevelReviewStage<br/>HEAVY]
    FR[FileAnalysisStage<br/>HEAVY]
    AST[CodeAnalysisASTStage<br/>HEAVY]
    CPLC[CreatePrLevelCommentsStage]
    CFC[CreateFileCommentsStage]
    AR[AggregateResultsStage]
    UCGS[UpdateCommentsAndGenerateSummaryStage]
    RCOA[RequestChangesOrApproveStage]

    VNC --> VC
    RC --> VC
    VC --> FCF
    FCF --> LEC
    LEC --> FCG
    FCG --> IC
    IC --> PRL
    PRL --> FR
    FR --> AST
    AST --> CPLC
    AST --> CFC
    CPLC --> AR
    CFC --> AR
    AR --> UCGS
    UCGS --> RCOA

    style PRL fill:#ffe1f5
    style FR fill:#ffe1f5
    style AST fill:#ffe1f5
```

---

## 📊 Diagrama 6: Fluxo de Eventos

```mermaid
graph LR
    subgraph "Heavy Stage"
        HS[Heavy Stage]
        HS -->|start| TASK[Trabalho Assíncrono]
        TASK -->|completa| EVENT[Publica Evento]
    end

    subgraph "Event Bus"
        EVENT -->|stage.completed.*| RMQ[RabbitMQ]
    end

    subgraph "Event Handler"
        RMQ --> HSEH[HeavyStageEventHandler]
        HSEH -->|busca| DB[(Jobs WAITING_FOR_EVENT)]
        HSEH -->|publica| RESUME[workflow.jobs.resumed]
    end

    subgraph "Resume Flow"
        RESUME --> WRC[WorkflowResumedConsumer]
        WRC --> CRP[CodeReviewJobProcessor]
        CRP -->|resume| PE[PipelineExecutor]
        PE -->|continua| NEXT[Próximos Stages]
    end

    style HS fill:#ffe1f5
    style EVENT fill:#e1ffe1
    style HSEH fill:#fff4e1
    style RESUME fill:#e1f5ff
```

---

## 📊 Diagrama 7: Escalabilidade

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[NGINX/Load Balancer]
    end

    subgraph "Webhook Handlers"
        WH1[Webhook Handler 1]
        WH2[Webhook Handler 2]
        WH3[Webhook Handler N]
    end

    subgraph "Message Queue"
        RMQ[RabbitMQ Cluster]
    end

    subgraph "Workers"
        W1[Worker 1<br/>Processa jobs]
        W2[Worker 2<br/>Processa jobs]
        W3[Worker 3<br/>Processa jobs]
        WN[Worker N<br/>Processa jobs]
    end

    subgraph "Database"
        PG[(PostgreSQL<br/>Primary + Replicas)]
    end

    LB --> WH1
    LB --> WH2
    LB --> WH3
    WH1 --> RMQ
    WH2 --> RMQ
    WH3 --> RMQ
    RMQ --> W1
    RMQ --> W2
    RMQ --> W3
    RMQ --> WN
    W1 --> PG
    W2 --> PG
    W3 --> PG
    WN --> PG

    style LB fill:#e1f5ff
    style RMQ fill:#fff4e1
    style PG fill:#ffe1f5
```

---

## 📊 Diagrama 8: Tratamento de Erros

```mermaid
graph TD
    START[Stage Executa]
    START -->|sucesso| SAVE[Salva Estado]
    START -->|erro| CLASSIFY[Classifica Erro]

    CLASSIFY -->|retryable| RETRY{Retries<br/>disponíveis?}
    CLASSIFY -->|não retryable| FAIL[Falha Permanente]

    RETRY -->|sim| COMPENSATE[Executa Compensação]
    RETRY -->|não| FAIL

    COMPENSATE --> SCHEDULE[Agenda Retry]
    SCHEDULE --> WAIT[Aguarda Delay]
    WAIT --> RETRY_JOB[Reenfileira Job]

    FAIL --> ROLLBACK[Rollback Parcial]
    ROLLBACK --> MARK_FAILED[Marca Job como FAILED]

    SAVE --> NEXT[Próximo Stage]
    RETRY_JOB --> START

    style START fill:#fff4e1
    style FAIL fill:#ffcccc
    style COMPENSATE fill:#ffe1f5
    style SAVE fill:#e1ffe1
```

---

## 📊 Diagrama 9: Comparação: Antes vs Depois

```mermaid
graph TB
    subgraph "ANTES: Síncrono"
        A1[Webhook] --> A2[RunCodeReviewAutomationUseCase]
        A2 --> A3[PipelineExecutor]
        A3 --> A4[Stages Sequenciais]
        A4 --> A5[Bloqueia Worker]
        A5 --> A6[Sem Persistência]
        A6 --> A7[Sem Pausa/Resume]
    end

    subgraph "DEPOIS: Assíncrono"
        D1[Webhook] --> D2[WebhookProcessingJobProcessor]
        D2 --> D3[RabbitMQ Queue]
        D3 --> D4[CodeReviewJobProcessor]
        D4 --> D5[PipelineExecutor]
        D5 --> D6[Stages com Persistência]
        D6 --> D7[Heavy Stages Pausam]
        D7 --> D8[Worker Liberado]
        D8 --> D9[Retoma via Eventos]
    end

    style A5 fill:#ffcccc
    style A6 fill:#ffcccc
    style A7 fill:#ffcccc
    style D7 fill:#e1ffe1
    style D8 fill:#e1ffe1
    style D9 fill:#e1ffe1
```

---

## 📊 Diagrama 10: Fluxo de Testes

```mermaid
graph TD
    START[Iniciar Teste]
    START --> UNIT[Testes Unitários]
    START --> INT[Testes de Integração]
    START --> E2E[Testes E2E]

    UNIT --> U1[Testar Stage isolado]
    UNIT --> U2[Testar PipelineExecutor]
    UNIT --> U3[Testar StateManager]

    INT --> I1[Testar fluxo completo]
    INT --> I2[Testar pausa/resume]
    INT --> I3[Testar persistência]

    E2E --> E1[Webhook → Pipeline → Comentários]
    E2E --> E2[Pausa → Evento → Resume]
    E2E --> E3[Múltiplos PRs paralelos]

    U1 --> REPORT[Relatório de Testes]
    U2 --> REPORT
    U3 --> REPORT
    I1 --> REPORT
    I2 --> REPORT
    I3 --> REPORT
    E1 --> REPORT
    E2 --> REPORT
    E3 --> REPORT

    style UNIT fill:#e1f5ff
    style INT fill:#fff4e1
    style E2E fill:#ffe1f5
    style REPORT fill:#e1ffe1
```
