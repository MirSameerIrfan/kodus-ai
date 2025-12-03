# Arquitetura Ideal - Software e Infraestrutura

## 📋 Visão Geral

Este documento descreve como seria uma arquitetura ideal seguindo boas práticas de software e infraestrutura, considerando o contexto atual do projeto (monorepo NestJS, RabbitMQ, PostgreSQL, etc.).

**Nota**: Esta é uma visão teórica/ideal. Não vamos aplicar agora, apenas ter uma noção de como evoluir.

---

## 🏗️ Parte 1: Arquitetura de Software

### 1.1 Clean Architecture / Hexagonal Architecture

#### Estrutura Ideal de Camadas

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  (Controllers, DTOs, Validators, HTTP/GraphQL)               │
│                                                             │
│  • Controllers HTTP                                         │
│  • GraphQL Resolvers (opcional)                              │
│  • WebSocket Handlers (opcional)                            │
│  • DTOs e Validators                                        │
│  • Exception Filters                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  (Use Cases, Orchestration, Application Services)           │
│                                                             │
│  • Use Cases (casos de uso)                                │
│  • Application Services (orquestração)                      │
│  • Command/Query Handlers (CQRS)                            │
│  • Event Handlers (domínio → aplicação)                     │
│  • DTOs de aplicação                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                            │
│  (Entities, Value Objects, Domain Services, Rules)         │
│                                                             │
│  • Entities (agregados)                                      │
│  • Value Objects                                            │
│  • Domain Services                                          │
│  • Domain Events                                            │
│  • Business Rules                                           │
│  • Interfaces/Contracts (portas)                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                       │
│  (Repositories, External Services, Database, Message Queue) │
│                                                             │
│  • Repository Implementations (TypeORM, MongoDB)            │
│  • External API Clients (GitHub, GitLab, LLM)              │
│  • Message Queue (RabbitMQ)                                 │
│  • Cache (Redis)                                            │
│  • File Storage (S3)                                        │
│  • Observability (OpenTelemetry, Sentry)                    │
└─────────────────────────────────────────────────────────────┘
```

#### Princípios

1. **Dependency Rule**: Dependências sempre apontam para dentro (Domain não depende de nada)
2. **Ports & Adapters**: Domain define interfaces (portas), Infrastructure implementa (adapters)
3. **Use Cases**: Cada caso de uso é uma classe isolada e testável
4. **Domain-Driven Design**: Entidades ricas com lógica de negócio

---

### 1.2 Estrutura de Diretórios Ideal

```
kodus-ai/
├── src/
│   ├── presentation/              # Camada de apresentação
│   │   ├── http/
│   │   │   ├── controllers/      # Controllers HTTP
│   │   │   ├── dto/              # DTOs de request/response
│   │   │   ├── validators/       # Validators
│   │   │   ├── filters/          # Exception filters
│   │   │   └── guards/           # Auth guards
│   │   ├── graphql/              # GraphQL (opcional)
│   │   └── websocket/            # WebSocket (opcional)
│   │
│   ├── application/               # Camada de aplicação
│   │   ├── use-cases/            # Use cases
│   │   │   ├── code-review/
│   │   │   │   ├── enqueue-code-review-job.use-case.ts
│   │   │   │   └── process-code-review.use-case.ts
│   │   │   └── workflow-queue/
│   │   ├── services/             # Application services
│   │   ├── commands/             # Command handlers (CQRS)
│   │   ├── queries/              # Query handlers (CQRS)
│   │   └── events/               # Event handlers
│   │
│   ├── domain/                    # Camada de domínio
│   │   ├── entities/             # Entidades de domínio
│   │   │   ├── workflow-job.entity.ts
│   │   │   ├── code-review.entity.ts
│   │   │   └── pull-request.entity.ts
│   │   ├── value-objects/        # Value objects
│   │   │   ├── job-status.vo.ts
│   │   │   └── correlation-id.vo.ts
│   │   ├── services/             # Domain services
│   │   │   ├── code-review.service.ts
│   │   │   └── workflow-orchestrator.service.ts
│   │   ├── events/               # Domain events
│   │   │   ├── job-created.event.ts
│   │   │   └── code-review-completed.event.ts
│   │   ├── repositories/         # Repository interfaces (portas)
│   │   │   ├── workflow-job.repository.interface.ts
│   │   │   └── code-review.repository.interface.ts
│   │   └── rules/               # Business rules
│   │       └── code-review-rules.ts
│   │
│   ├── infrastructure/            # Camada de infraestrutura
│   │   ├── persistence/          # Repositórios
│   │   │   ├── typeorm/
│   │   │   │   ├── workflow-job.repository.ts
│   │   │   │   └── code-review.repository.ts
│   │   │   └── mongodb/
│   │   ├── messaging/            # Message queue
│   │   │   ├── rabbitmq/
│   │   │   │   ├── job-queue.service.ts
│   │   │   │   └── event-publisher.service.ts
│   │   ├── external/            # APIs externas
│   │   │   ├── github/
│   │   │   │   ├── github-api.client.ts
│   │   │   │   └── github-webhook.validator.ts
│   │   │   ├── llm/
│   │   │   │   └── openai.client.ts
│   │   │   └── ast/
│   │   │       └── ast-service.client.ts
│   │   ├── cache/               # Cache
│   │   │   └── redis-cache.service.ts
│   │   ├── storage/             # File storage
│   │   │   └── s3-storage.service.ts
│   │   └── observability/       # Observability
│   │       ├── tracing.service.ts
│   │       └── metrics.service.ts
│   │
│   └── shared/                    # Código compartilhado
│       ├── domain/               # Entidades compartilhadas
│       ├── infrastructure/       # Infra compartilhada
│       └── utils/               # Utilitários
│
├── packages/                      # Monorepo packages
│   ├── kodus-common/            # Utilitários comuns
│   ├── kodus-flow/              # Framework de agentes
│   └── kodus-workflow-sdk/      # SDK de workflow (futuro)
│
└── apps/                          # Aplicações separadas (opcional)
    ├── webhook-handler/          # App webhook handler
    ├── api-rest/                 # App API REST
    └── worker/                   # App worker
```

---

### 1.3 Separação por Bounded Contexts (DDD)

#### Bounded Contexts Identificados

```
┌─────────────────────────────────────────────────────────────┐
│              WORKFLOW QUEUE CONTEXT                          │
│                                                             │
│  • WorkflowJob (aggregate root)                             │
│  • JobExecutionHistory                                      │
│  • OutboxMessage                                            │
│  • Domain Services: WorkflowOrchestrator                    │
│  • Use Cases: EnqueueJob, ProcessJob                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              CODE REVIEW CONTEXT                             │
│                                                             │
│  • CodeReview (aggregate root)                              │
│  • PullRequest                                              │
│  • CodeSuggestion                                           │
│  • Domain Services: CodeReviewService                       │
│  • Use Cases: AnalyzeCode, GenerateSuggestions             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PLATFORM INTEGRATION CONTEXT                    │
│                                                             │
│  • Integration (aggregate root)                              │
│  • Repository                                               │
│  • WebhookEvent                                             │
│  • Domain Services: WebhookValidator                        │
│  • Use Cases: ReceiveWebhook, SyncRepository               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              ORGANIZATION CONTEXT                            │
│                                                             │
│  • Organization (aggregate root)                            │
│  • Team                                                     │
│  • User                                                     │
│  • Domain Services: LicenseValidator                        │
│  • Use Cases: CreateOrganization, AssignLicense           │
└─────────────────────────────────────────────────────────────┘
```

#### Context Mapping

```
Workflow Queue Context ──→ Code Review Context
         │                        │
         │                        │
         └──────────┬─────────────┘
                    │
                    ↓
         Platform Integration Context
                    │
                    ↓
         Organization Context
```

**Padrões de Integração**:

- **Shared Kernel**: Entidades compartilhadas (User, Organization)
- **Customer-Supplier**: Workflow Queue → Code Review
- **Conformist**: Platform Integration → External APIs (GitHub, GitLab)

---

### 1.4 CQRS (Command Query Responsibility Segregation)

#### Separação de Leitura e Escrita

```typescript
// COMMAND SIDE (Write)
┌─────────────────────────────────────────┐
│ Command Handlers                        │
│                                         │
│ • EnqueueCodeReviewJobCommand           │
│ • ProcessWorkflowJobCommand              │
│ • UpdateJobStatusCommand                 │
│                                         │
│ → Write to Database                     │
│ → Publish Events                        │
└─────────────────────────────────────────┘

// QUERY SIDE (Read)
┌─────────────────────────────────────────┐
│ Query Handlers                         │
│                                         │
│ • GetJobStatusQuery                     │
│ • ListJobsQuery                         │
│ • GetJobMetricsQuery                    │
│                                         │
│ → Read from Read Model (View)          │
│ → Optimized for queries                 │
└─────────────────────────────────────────┘
```

#### Read Models (Projections)

```typescript
// Read Model otimizado para queries
interface JobStatusView {
    id: string;
    status: JobStatus;
    workflowType: WorkflowType;
    createdAt: Date;
    updatedAt: Date;
    // Campos denormalizados para performance
    organizationName: string;
    repositoryName: string;
    pullRequestNumber: number;
}

// Projeção atualizada via eventos
class JobStatusProjection {
    async handleJobCreated(event: JobCreatedEvent) {
        await this.readModel.save({
            id: event.jobId,
            status: 'PENDING',
            // ... denormalizar dados
        });
    }
}
```

---

### 1.5 Event-Driven Architecture

#### Domain Events

```typescript
// Domain Event
class JobCreatedEvent {
    constructor(
        public readonly jobId: string,
        public readonly workflowType: WorkflowType,
        public readonly occurredAt: Date,
    ) {}
}

// Event Handler (Application Layer)
class JobCreatedHandler {
    async handle(event: JobCreatedEvent) {
        // Atualizar read model
        await this.jobStatusProjection.update(event);

        // Publicar métricas
        await this.metricsService.increment('jobs.created');

        // Notificar usuário (opcional)
        await this.notificationService.notify(event);
    }
}
```

#### Event Sourcing (Opcional, para casos críticos)

```typescript
// Event Store
interface EventStore {
    save(streamId: string, events: DomainEvent[]): Promise<void>;
    load(streamId: string): Promise<DomainEvent[]>;
}

// Aggregate reconstrói estado a partir de eventos
class WorkflowJob {
    static fromEvents(events: DomainEvent[]): WorkflowJob {
        return events.reduce((job, event) => {
            return job.apply(event);
        }, new WorkflowJob());
    }
}
```

---

## 🏗️ Parte 2: Arquitetura de Infraestrutura

### 2.1 Cloud Architecture (AWS)

#### Arquitetura Ideal na AWS

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERNET                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AWS CLOUDFRONT (CDN)                            │
│  • Cache estático                                            │
│  • SSL/TLS termination                                       │
│  • DDoS protection                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AWS APPLICATION LOAD BALANCER                   │
│  • Health checks                                             │
│  • SSL termination                                            │
│  • Routing rules                                             │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   ECS Fargate│   │   ECS Fargate│   │   ECS Fargate│
│              │   │              │   │              │
│ Webhook      │   │ API REST     │   │ Worker       │
│ Handler      │   │              │   │              │
│              │   │              │   │              │
│ Port: 3332   │   │ Port: 3331   │   │ No HTTP      │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AWS ELASTICACHE (Redis)                         │
│  • Session storage                                           │
│  • Cache                                                     │
│  • Rate limiting                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AWS RDS (PostgreSQL)                            │
│  • Multi-AZ (high availability)                              │
│  • Read replicas (scalability)                              │
│  • Automated backups                                         │
│  • Point-in-time recovery                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AWS DOCUMENTDB (MongoDB)                        │
│  • Multi-AZ                                                  │
│  • Automated backups                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AWS MQ (RabbitMQ)                               │
│  • Managed RabbitMQ                                         │
│  • High availability                                         │
│  • Automatic failover                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AWS S3                                          │
│  • File storage                                              │
│  • Logs storage                                              │
│  • Backup storage                                            │
└─────────────────────────────────────────────────────────────┘
```

#### Alternativa: Kubernetes (EKS)

```
┌─────────────────────────────────────────────────────────────┐
│              KUBERNETES CLUSTER (EKS)                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              INGRESS CONTROLLER                      │   │
│  │  • NGINX Ingress                                     │   │
│  │  • SSL/TLS termination                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│        ┌───────────────────┼───────────────────┐           │
│        ↓                   ↓                   ↓           │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐         │
│  │  POD     │      │  POD     │      │  POD     │         │
│  │          │      │          │      │          │         │
│  │ Webhook  │      │ API REST │      │ Worker   │         │
│  │ Handler  │      │          │      │          │         │
│  │          │      │          │      │          │         │
│  │ Replicas:│      │ Replicas:│      │ Replicas:│         │
│  │ 3-5      │      │ 5-10     │      │ 10-20    │         │
│  └──────────┘      └──────────┘      └──────────┘         │
│        │                   │                   │           │
│        └───────────────────┼───────────────────┘           │
│                            ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SERVICE MESH (Istio)                   │   │
│  │  • Service discovery                                │   │
│  │  • Load balancing                                   │   │
│  │  • Circuit breaker                                  │   │
│  │  • Distributed tracing                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.2 Containerização

#### Dockerfile Multi-Stage Otimizado

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# Stage 2: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build:production

# Stage 3: Runtime (otimizado por componente)
FROM node:22-alpine AS webhook-handler
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
ENV COMPONENT_TYPE=webhook
CMD ["node", "dist/src/webhook-handler.js"]

FROM node:22-alpine AS api-rest
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
ENV COMPONENT_TYPE=api
CMD ["node", "dist/src/main.js"]

FROM node:22-alpine AS worker
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
ENV COMPONENT_TYPE=worker
CMD ["node", "dist/src/worker.js"]
```

#### Docker Compose para Desenvolvimento

```yaml
version: '3.8'

services:
    webhook-handler:
        build:
            context: .
            target: webhook-handler
        ports:
            - '3332:3332'
        environment:
            - COMPONENT_TYPE=webhook
            - DATABASE_URL=postgresql://...
            - RABBITMQ_URL=amqp://...
        depends_on:
            - postgres
            - rabbitmq

    api-rest:
        build:
            context: .
            target: api-rest
        ports:
            - '3331:3331'
        environment:
            - COMPONENT_TYPE=api
            - DATABASE_URL=postgresql://...
        depends_on:
            - postgres

    worker:
        build:
            context: .
            target: worker
        environment:
            - COMPONENT_TYPE=worker
            - DATABASE_URL=postgresql://...
            - RABBITMQ_URL=amqp://...
        depends_on:
            - postgres
            - rabbitmq
        deploy:
            replicas: 3 # Escalar workers facilmente

    postgres:
        image: postgres:16-alpine
        environment:
            POSTGRES_DB: kodus
        volumes:
            - postgres_data:/var/lib/postgresql/data

    rabbitmq:
        image: rabbitmq:4-management-alpine
        ports:
            - '5672:5672'
            - '15672:15672'
```

---

### 2.3 Service Mesh (Opcional, para microserviços)

#### Istio Service Mesh

```
┌─────────────────────────────────────────────────────────────┐
│              ISTIO SERVICE MESH                              │
│                                                             │
│  • Service Discovery (automatic)                            │
│  • Load Balancing (round-robin, least-conn, etc.)         │
│  • Circuit Breaker (automatic failover)                    │
│  • Retry Logic (exponential backoff)                        │
│  • Timeout Management                                      │
│  • Distributed Tracing (Jaeger/Zipkin)                     │
│  • Metrics (Prometheus)                                    │
│  • Security (mTLS between services)                        │
└─────────────────────────────────────────────────────────────┘
```

**Benefícios**:

- Observabilidade automática
- Resiliência (circuit breaker, retry)
- Segurança (mTLS)
- Sem mudanças no código

---

### 2.4 Database Architecture

#### Read Replicas para Escalabilidade

```
┌─────────────────────────────────────────────────────────────┐
│              WRITE DATABASE (Primary)                       │
│  • PostgreSQL Multi-AZ                                      │
│  • Handles all writes                                        │
│  • Replicates to read replicas                              │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ READ REPLICA │   │ READ REPLICA │   │ READ REPLICA │
│   (us-east)  │   │   (us-west)  │   │   (eu-west)  │
│              │   │              │   │              │
│ • Queries    │   │ • Queries    │   │ • Queries    │
│ • Reports    │   │ • Reports    │   │ • Reports    │
│ • Analytics  │   │ • Analytics  │   │ • Analytics  │
└──────────────┘   └──────────────┘   └──────────────┘
```

#### Connection Pooling (PgBouncer)

```
┌─────────────────────────────────────────────────────────────┐
│              PGBOUNCER (Connection Pooler)                   │
│                                                             │
│  • Transaction pooling mode                                 │
│  • Reduces connection overhead                               │
│  • Allows more clients with fewer DB connections            │
│                                                             │
│  Clients: 1000+ → PgBouncer: 50 → PostgreSQL: 50          │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.5 Message Queue Architecture

#### RabbitMQ Cluster (High Availability)

```
┌─────────────────────────────────────────────────────────────┐
│              RABBITMQ CLUSTER                                │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   NODE 1     │  │   NODE 2     │  │   NODE 3     │     │
│  │  (Primary)   │  │  (Replica)   │  │  (Replica)   │     │
│  │              │  │              │  │              │     │
│  │ Quorum Queue │  │ Quorum Queue │  │ Quorum Queue │     │
│  │ (Raft)       │  │ (Raft)       │  │ (Raft)       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  • Automatic failover                                       │
│  • Data replication                                         │
│  • No single point of failure                              │
└─────────────────────────────────────────────────────────────┘
```

#### Dead Letter Queue (DLQ) Strategy

```
┌─────────────────────────────────────────────────────────────┐
│              WORKFLOW.JOBS.QUEUE                            │
│                                                             │
│  • Max retries: 3                                           │
│  • TTL: 1 hour                                              │
│  • Dead letter exchange: workflow.exchange.dlx              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓ (after max retries)
┌─────────────────────────────────────────────────────────────┐
│              WORKFLOW.DLQ                                    │
│                                                             │
│  • Failed jobs                                              │
│  • Alerting                                                 │
│  • Manual retry capability                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Parte 3: Observabilidade

### 3.1 Three Pillars of Observability

#### 1. Logs (Centralized)

```
┌─────────────────────────────────────────────────────────────┐
│              APPLICATION LOGS                                │
│                                                             │
│  • Structured logging (JSON)                                │
│  • Correlation IDs                                          │
│  • Log levels (DEBUG, INFO, WARN, ERROR)                    │
│                                                             │
│  → CloudWatch Logs / ELK Stack / Datadog                    │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Metrics (Time-Series)

```
┌─────────────────────────────────────────────────────────────┐
│              METRICS COLLECTED                               │
│                                                             │
│  • Request rate (req/s)                                     │
│  • Error rate (%)                                           │
│  • Latency (p50, p95, p99)                                 │
│  • Queue depth                                              │
│  • Job processing time                                      │
│  • Database connection pool usage                           │
│                                                             │
│  → Prometheus + Grafana / CloudWatch                        │
└─────────────────────────────────────────────────────────────┘
```

#### 3. Traces (Distributed Tracing)

```
┌─────────────────────────────────────────────────────────────┐
│              DISTRIBUTED TRACING                             │
│                                                             │
│  Trace ID: abc123                                           │
│  │                                                           │
│  ├─ Webhook Handler (100ms)                                 │
│  │  ├─ Validate signature (10ms)                           │
│  │  ├─ Enqueue job (20ms)                                   │
│  │  └─ Save to DB (70ms)                                    │
│  │                                                           │
│  ├─ Worker (5000ms)                                        │
│  │  ├─ Process job (100ms)                                 │
│  │  ├─ Call LLM (4000ms)                                   │
│  │  ├─ AST Analysis (800ms)                                │
│  │  └─ Publish comments (100ms)                             │
│  │                                                           │
│  → OpenTelemetry + Jaeger / AWS X-Ray                       │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.2 APM (Application Performance Monitoring)

```
┌─────────────────────────────────────────────────────────────┐
│              APM TOOLS                                       │
│                                                             │
│  • New Relic                                                │
│  • Datadog APM                                              │
│  • AWS X-Ray                                                │
│  • Sentry (error tracking)                                 │
│                                                             │
│  Features:                                                  │
│  • Slow query detection                                     │
│  • N+1 query detection                                      │
│  • Memory leak detection                                    │
│  • Error tracking                                           │
│  • Performance profiling                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Parte 4: Segurança

### 4.1 Network Security

```
┌─────────────────────────────────────────────────────────────┐
│              VPC ARCHITECTURE                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PUBLIC SUBNET                          │   │
│  │  • Load Balancer                                    │   │
│  │  • NAT Gateway                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PRIVATE SUBNET                         │   │
│  │  • ECS Tasks (Webhook, API, Worker)                │   │
│  │  • RDS (PostgreSQL)                                 │   │
│  │  • ElastiCache (Redis)                              │   │
│  │  • AWS MQ (RabbitMQ)                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  • Security Groups (firewall rules)                        │
│  • Network ACLs                                            │
│  • No direct internet access                               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Secrets Management

```
┌─────────────────────────────────────────────────────────────┐
│              AWS SECRETS MANAGER                            │
│                                                             │
│  • Database credentials                                     │
│  • API keys (GitHub, GitLab, etc.)                         │
│  • LLM API keys                                            │
│  • JWT secrets                                             │
│                                                             │
│  • Automatic rotation                                      │
│  • Encryption at rest                                      │
│  • Access via IAM roles                                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────┐
│              AUTHENTICATION FLOW                            │
│                                                             │
│  1. User → API REST                                         │
│  2. API REST → AWS Cognito (JWT validation)               │
│  3. API REST → Check permissions (RBAC/CASL)                │
│  4. API REST → Process request                             │
│                                                             │
│  Webhook Handler:                                           │
│  • Signature validation (HMAC)                           │
│  • No user authentication needed                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Parte 5: CI/CD

### 5.1 Pipeline Ideal

```
┌─────────────────────────────────────────────────────────────┐
│              CI/CD PIPELINE                                 │
│                                                             │
│  1. CODE COMMIT                                             │
│     ↓                                                       │
│  2. GITHUB ACTIONS / GITLAB CI                             │
│     ├─ Lint                                                 │
│     ├─ Unit Tests                                           │
│     ├─ Integration Tests                                    │
│     ├─ Build Docker images                                 │
│     └─ Security scan (Snyk, Trivy)                        │
│     ↓                                                       │
│  3. PUSH TO ECR (Docker Registry)                          │
│     ↓                                                       │
│  4. DEPLOY TO STAGING                                       │
│     ├─ ECS Fargate / EKS                                   │
│     ├─ Run migrations                                      │
│     ├─ Smoke tests                                         │
│     └─ Integration tests                                   │
│     ↓                                                       │
│  5. MANUAL APPROVAL (opcional)                             │
│     ↓                                                       │
│  6. DEPLOY TO PRODUCTION                                    │
│     ├─ Blue-Green Deployment                               │
│     ├─ Canary Deployment                                   │
│     ├─ Rollback capability                                 │
│     └─ Health checks                                        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Deployment Strategies

#### Blue-Green Deployment

```
┌─────────────────────────────────────────────────────────────┐
│              BLUE-GREEN DEPLOYMENT                           │
│                                                             │
│  ┌──────────────┐              ┌──────────────┐             │
│  │   BLUE       │              │   GREEN      │             │
│  │  (Current)   │              │  (New)       │             │
│  │              │              │              │             │
│  │ v1.0.0       │              │ v1.1.0       │             │
│  └──────────────┘              └──────────────┘             │
│         │                            │                      │
│         └────────────┬───────────────┘                      │
│                      ↓                                       │
│              ┌──────────────┐                               │
│              │ LOAD BALANCER│                               │
│              └──────────────┘                               │
│                                                             │
│  • Switch traffic instantly                                 │
│  • Rollback: switch back                                    │
│  • Zero downtime                                           │
└─────────────────────────────────────────────────────────────┘
```

#### Canary Deployment

```
┌─────────────────────────────────────────────────────────────┐
│              CANARY DEPLOYMENT                               │
│                                                             │
│  ┌──────────────┐              ┌──────────────┐             │
│  │   STABLE     │              │   CANARY     │             │
│  │              │              │              │             │
│  │ 90% traffic  │              │ 10% traffic  │             │
│  └──────────────┘              └──────────────┘             │
│                                                             │
│  • Gradual rollout                                           │
│  • Monitor metrics                                           │
│  • Increase to 50%, then 100%                               │
│  • Rollback if errors detected                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Parte 6: Escalabilidade

### 6.1 Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────┐
│              AUTO-SCALING POLICIES                          │
│                                                             │
│  Webhook Handler:                                           │
│  • Scale based on: Request rate                             │
│  • Min: 2, Max: 10                                          │
│  • Target: 70% CPU                                          │
│                                                             │
│  API REST:                                                  │
│  • Scale based on: Request rate, CPU                        │
│  • Min: 3, Max: 20                                          │
│  • Target: 70% CPU                                          │
│                                                             │
│  Workers:                                                   │
│  • Scale based on: Queue depth                              │
│  • Min: 5, Max: 50                                          │
│  • Target: Queue depth < 100                                │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│              CACHING LAYERS                                  │
│                                                             │
│  L1: Application Cache (in-memory)                          │
│  • TTL: 5 minutes                                           │
│  • Use: Frequently accessed data                            │
│                                                             │
│  L2: Redis Cache                                            │
│  • TTL: 1 hour                                              │
│  • Use: User sessions, API responses                       │
│                                                             │
│  L3: CDN (CloudFront)                                      │
│  • TTL: 24 hours                                            │
│  • Use: Static assets, public APIs                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Resumo: Evolução da Arquitetura

### Estado Atual → Estado Ideal

```
┌─────────────────────────────────────────────────────────────┐
│              EVOLUÇÃO                                        │
│                                                             │
│  ATUAL:                                                      │
│  • Monorepo NestJS                                          │
│  • 3 processos separados (PM2)                              │
│  • PostgreSQL + MongoDB                                     │
│  • RabbitMQ                                                 │
│  • Docker + EC2                                             │
│                                                             │
│  ↓                                                           │
│                                                             │
│  IDEAL:                                                      │
│  • Clean Architecture (camadas bem definidas)               │
│  • CQRS (separação read/write)                             │
│  • Event-Driven (domain events)                             │
│  • Microservices (opcional, se necessário)                  │
│  • Kubernetes (EKS) ou ECS Fargate                         │
│  • Service Mesh (Istio)                                    │
│  • Read Replicas (PostgreSQL)                              │
│  • Connection Pooling (PgBouncer)                           │
│  • Distributed Tracing (OpenTelemetry)                      │
│  • APM (Datadog/New Relic)                                 │
│  • Auto-scaling                                             │
│  • Blue-Green / Canary deployments                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 Recomendações Práticas

### Fase 1: Melhorias Imediatas (1-3 meses)

1. ✅ **Clean Architecture**: Separar camadas (já parcialmente feito)
2. ✅ **CQRS**: Separar queries de commands
3. ✅ **Event-Driven**: Implementar domain events
4. ✅ **Observability**: OpenTelemetry + Grafana
5. ✅ **Connection Pooling**: PgBouncer

### Fase 2: Infraestrutura (3-6 meses)

1. ✅ **Cloud Migration**: AWS ECS Fargate ou EKS
2. ✅ **Read Replicas**: PostgreSQL read replicas
3. ✅ **Auto-scaling**: Configurar políticas
4. ✅ **CI/CD**: GitHub Actions + Blue-Green deployment
5. ✅ **Secrets Management**: AWS Secrets Manager

### Fase 3: Avançado (6-12 meses)

1. ✅ **Service Mesh**: Istio (se microserviços)
2. ✅ **Event Sourcing**: Para casos críticos
3. ✅ **GraphQL**: Se necessário
4. ✅ **Multi-region**: Para alta disponibilidade
5. ✅ **Chaos Engineering**: Testar resiliência

---

## 📚 Referências

- **Clean Architecture**: Robert C. Martin
- **Domain-Driven Design**: Eric Evans
- **Building Microservices**: Sam Newman
- **Site Reliability Engineering**: Google SRE Book
- **AWS Well-Architected Framework**

---

**Nota**: Esta é uma visão ideal. A implementação deve ser gradual e baseada em necessidades reais, não em perfeição teórica.
