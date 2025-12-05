# Análise Profunda: Arquitetura de Queues e Workflows

## 🎯 Objetivo

Definir a melhor arquitetura para organizar queues e workflows considerando:

- ✅ Boas práticas de message queues
- ✅ Performance e throughput
- ✅ Resiliência e fault tolerance
- ✅ Manutenabilidade e extensibilidade
- ✅ Escalabilidade (adicionar novas queues facilmente)

---

## 📊 Análise da Situação Atual

### Tipos de Workflows Identificados

1. **CODE_REVIEW** - Processamento de code review
2. **WEBHOOK_PROCESSING** - Processamento de webhooks
3. **AST_TASK** - Tarefas de análise AST
4. **CODE_REVIEW_FEEDBACK** - Feedback de code review

### Padrões Atuais

- ✅ Transactional Outbox Pattern (já implementado)
- ✅ Transactional Inbox Pattern (já implementado)
- ✅ Dead Letter Queue (já implementado)
- ✅ Quorum Queues (já implementado)
- ⚠️ Routing keys genéricos (`workflow.jobs.created.*`)
- ⚠️ Tudo na mesma queue (`workflow.jobs.queue`)

---

## 🏗️ Opções de Arquitetura

### Opção A: Single Queue com Routing Keys (Atual)

```
workflow.exchange (topic)
├── workflow.jobs.queue
│   ├── workflow.jobs.created.code_review
│   ├── workflow.jobs.created.webhook_processing
│   └── workflow.jobs.created.*
```

**Prós:**

- ✅ Simples de implementar
- ✅ Fácil de começar
- ✅ Menos overhead de infraestrutura

**Contras:**

- ❌ **Sem isolamento**: Um workflow lento bloqueia outros
- ❌ **Sem priorização**: Todos os workflows têm mesma prioridade
- ❌ **Escalabilidade limitada**: Não pode escalar workflows independentemente
- ❌ **Debugging difícil**: Logs misturados
- ❌ **Retry policy única**: Não pode ter retry diferente por workflow
- ❌ **Resource contention**: Todos competem pelos mesmos workers

**Quando usar:**

- Projetos pequenos
- Workflows com características similares
- Throughput baixo

---

### Opção B: Queue por Workflow Type (Recomendada) ⭐

```
workflow.exchange (topic)
├── workflow.jobs.code_review.queue
│   └── routing: workflow.jobs.created.code_review
├── workflow.jobs.webhook.queue
│   └── routing: workflow.jobs.created.webhook_processing
├── workflow.jobs.ast.queue
│   └── routing: workflow.jobs.created.ast_task
└── workflow.jobs.feedback.queue
    └── routing: workflow.jobs.created.feedback
```

**Prós:**

- ✅ **Isolamento**: Cada workflow roda independentemente
- ✅ **Escalabilidade**: Pode escalar workers por workflow
- ✅ **Priorização**: Pode ter prioridades diferentes
- ✅ **Retry policies**: Cada workflow pode ter sua própria política
- ✅ **Debugging**: Logs separados por workflow
- ✅ **Resource allocation**: Pode alocar recursos específicos
- ✅ **Monitoring**: Métricas por workflow
- ✅ **Deploy independente**: Pode atualizar um workflow sem afetar outros

**Contras:**

- ⚠️ Mais queues para gerenciar
- ⚠️ Mais configuração inicial

**Quando usar:**

- ✅ **Produção em escala**
- ✅ Workflows com características diferentes
- ✅ Necessidade de isolamento
- ✅ **SEU CASO ATUAL** 🎯

---

### Opção C: Queue por Prioridade + Workflow Type (Híbrida)

```
workflow.exchange (topic)
├── workflow.jobs.high.code_review.queue
├── workflow.jobs.medium.code_review.queue
├── workflow.jobs.low.code_review.queue
├── workflow.jobs.high.webhook.queue
└── ...
```

**Prós:**

- ✅ Isolamento por workflow
- ✅ Priorização granular
- ✅ Controle fino de recursos

**Contras:**

- ❌ Complexidade alta
- ❌ Muitas queues
- ❌ Overhead de gerenciamento

**Quando usar:**

- Sistemas críticos com SLA rigorosos
- Necessidade de priorização muito granular

---

### Opção D: Queue por Tenant/Organization (Multi-tenancy)

```
workflow.exchange (topic)
├── workflow.jobs.org-123.code_review.queue
├── workflow.jobs.org-456.code_review.queue
└── ...
```

**Prós:**

- ✅ Isolamento por tenant
- ✅ Compliance e segurança
- ✅ Rate limiting por tenant

**Contras:**

- ❌ Complexidade muito alta
- ❌ Muitas queues (N tenants × M workflows)
- ❌ Overhead significativo

**Quando usar:**

- SaaS multi-tenant
- Requisitos de isolamento por tenant
- Compliance rigoroso

---

## 🎯 Recomendação: Opção B (Queue por Workflow Type)

### Por que Opção B é a melhor para seu caso?

1. **Você já tem workflows diferentes**:
    - CODE_REVIEW (pesado, pode demorar)
    - WEBHOOK_PROCESSING (leve, precisa ser rápido)
    - AST_TASK (médio)
    - FEEDBACK (leve)

2. **Características diferentes**:
    - CODE_REVIEW: CPU intensivo, pode demorar minutos
    - WEBHOOK: I/O intensivo, precisa ser rápido (< 1s)
    - AST_TASK: CPU intensivo, pode demorar

3. **Necessidade de escalar independentemente**:
    - Webhooks precisam de muitos workers (alto throughput)
    - Code reviews precisam de poucos workers (baixo throughput, mas pesado)

4. **Manutenabilidade**:
    - Fácil adicionar novo workflow (nova queue)
    - Fácil remover workflow (remove queue)
    - Fácil debugar (logs separados)

---

## 🏗️ Arquitetura Recomendada Detalhada

### Estrutura de Queues

```typescript
// config/queue.constants.ts

export const QUEUE_CONFIG = {
    // Exchanges
    EXCHANGE: 'workflow.exchange',
    DEAD_LETTER_EXCHANGE: 'workflow.exchange.dlx',
    DELAYED_EXCHANGE: 'orchestrator.exchange.delayed',
    EVENTS_EXCHANGE: 'workflow.events',

    // Queues por Workflow Type
    CODE_REVIEW_QUEUE: 'workflow.jobs.code_review.queue',
    WEBHOOK_QUEUE: 'workflow.jobs.webhook.queue',
    AST_QUEUE: 'workflow.jobs.ast.queue',
    FEEDBACK_QUEUE: 'workflow.jobs.feedback.queue',

    // Dead Letter Queue
    DEAD_LETTER_QUEUE: 'workflow.dlx.queue',

    // Routing Keys
    CODE_REVIEW_ROUTING_KEY: 'workflow.jobs.created.code_review',
    WEBHOOK_ROUTING_KEY: 'workflow.jobs.created.webhook_processing',
    AST_ROUTING_KEY: 'workflow.jobs.created.ast_task',
    FEEDBACK_ROUTING_KEY: 'workflow.jobs.created.feedback',
} as const;

// Configuração por Workflow Type
export const WORKFLOW_QUEUE_CONFIG = {
    CODE_REVIEW: {
        queue: QUEUE_CONFIG.CODE_REVIEW_QUEUE,
        routingKey: QUEUE_CONFIG.CODE_REVIEW_ROUTING_KEY,
        prefetch: 1, // Processa 1 por vez (pesado)
        concurrency: 2, // Máximo 2 workers simultâneos
        retryLimit: 3,
        retryDelay: 60000, // 1 minuto
        timeout: 300000, // 5 minutos
        priority: 0, // Prioridade padrão (pode ser ajustada por job)
        rateLimitPerOrg: 10, // Max 10 jobs/segundo por organização
    },
    WEBHOOK_PROCESSING: {
        queue: QUEUE_CONFIG.WEBHOOK_QUEUE,
        routingKey: QUEUE_CONFIG.WEBHOOK_ROUTING_KEY,
        prefetch: 10, // Processa 10 por vez (leve)
        concurrency: 20, // Muitos workers simultâneos
        retryLimit: 5,
        retryDelay: 5000, // 5 segundos
        timeout: 30000, // 30 segundos
        priority: 0, // Prioridade padrão
        rateLimitPerOrg: 50, // Max 50 jobs/segundo por organização (alto throughput)
    },
    AST_TASK: {
        queue: QUEUE_CONFIG.AST_QUEUE,
        routingKey: QUEUE_CONFIG.AST_ROUTING_KEY,
        prefetch: 2,
        concurrency: 5,
        retryLimit: 3,
        retryDelay: 30000,
        timeout: 120000,
        priority: 0,
        rateLimitPerOrg: 20,
    },
    CODE_REVIEW_FEEDBACK: {
        queue: QUEUE_CONFIG.FEEDBACK_QUEUE,
        routingKey: QUEUE_CONFIG.FEEDBACK_ROUTING_KEY,
        prefetch: 5,
        concurrency: 10,
        retryLimit: 3,
        retryDelay: 10000,
        timeout: 60000,
        priority: 0,
        rateLimitPerOrg: 30,
    },
} as const;

// Configuração global de resiliência
export const QUEUE_RESILIENCE_CONFIG = {
    // Backpressure: rejeitar novos jobs quando fila exceder threshold
    backpressureThreshold: 10000, // Max jobs na fila antes de rejeitar
    backpressureEnabled: true,

    // Circuit breaker para serviços externos
    circuitBreakerFailureThreshold: 5, // Falhas consecutivas antes de abrir
    circuitBreakerTimeoutMs: 60000, // Tempo antes de tentar novamente

    // Priorização
    priorityEnabled: true, // Usar campo priority para ordenar trabalhos
    maxPriority: 10, // Prioridade máxima permitida

    // Rate limiting por organização
    rateLimitEnabled: true,
    rateLimitWindowMs: 1000, // Janela de 1 segundo
} as const;
```

### Estrutura de Módulos

```
workflowQueue/
├── config/
│   ├── queue-config.module.ts
│   ├── queue.constants.ts          # Constantes e configurações
│   ├── workflow-queue-config.ts    # Config por workflow type
│   ├── rabbit.constants.ts
│   └── rabbit.config.ts
├── api/
│   ├── queue.module.api.ts         # Módulo para API (publisher)
│   └── rabbitmq-job-queue.service.ts
├── worker/
│   ├── queue.module.worker.ts      # Módulo para Worker (consumer)
│   ├── consumers/
│   │   ├── code-review.consumer.ts
│   │   ├── webhook.consumer.ts
│   │   ├── ast.consumer.ts
│   │   └── feedback.consumer.ts
│   └── processors/
│       ├── code-review-processor.service.ts
│       ├── webhook-processor.service.ts
│       └── ...
├── shared/
│   ├── transactional-outbox.service.ts
│   ├── transactional-inbox.service.ts
│   ├── outbox-relay.service.ts
│   └── ...
└── definitions/
    └── workflow-queue.definition.ts
```

---

## 🔧 Implementação Recomendada

### 1. Consumer Base Abstrato

```typescript
// worker/shared/base-workflow-consumer.abstract.ts

import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { UseFilters } from '@nestjs/common';
import { RabbitmqConsumeErrorFilter } from '@/shared/infrastructure/filters/rabbitmq-consume-error.exception';
import { TransactionalInboxService } from '../../shared/transactional-inbox.service';
import { DataSource } from 'typeorm';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { ObservabilityService } from '@/core/infrastructure/adapters/services/logger/observability.service';
import { IJobProcessorService } from '@/core/domain/workflowQueue/contracts/job-processor.service.contract';
import { JOB_PROCESSOR_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/job-processor.service.contract';
import { Inject } from '@nestjs/common';

interface WorkflowJobMessage {
    jobId: string;
    correlationId: string;
    [key: string]: unknown;
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export abstract class BaseWorkflowConsumer {
    constructor(
        @Inject(JOB_PROCESSOR_SERVICE_TOKEN)
        protected readonly jobProcessor: IJobProcessorService,
        protected readonly inboxService: TransactionalInboxService,
        protected readonly dataSource: DataSource,
        protected readonly logger: PinoLoggerService,
        protected readonly observability: ObservabilityService,
    ) {}

    protected abstract getQueueConfig(): {
        queue: string;
        routingKey: string;
        exchange: string;
    };

    @RabbitSubscribe({
        exchange: 'workflow.exchange', // Será sobrescrito
        routingKey: 'workflow.jobs.*', // Será sobrescrito
        queue: 'workflow.jobs.queue', // Será sobrescrito
        createQueueIfNotExists: false,
        queueOptions: {
            durable: true,
            arguments: {
                'x-queue-type': 'quorum',
                'x-dead-letter-exchange': 'workflow.exchange.dlx',
            },
        },
    })
    async handleWorkflowJob(
        message: WorkflowJobMessage,
        amqpMsg: any,
    ): Promise<void> {
        const config = this.getQueueConfig();
        const messageId = amqpMsg?.properties?.messageId || amqpMsg?.messageId;
        const correlationId =
            amqpMsg?.properties?.headers?.['x-correlation-id'] ||
            message.correlationId ||
            amqpMsg?.properties?.correlationId;

        if (!messageId || !message.jobId) {
            this.logger.error({
                message: 'Invalid workflow job message',
                context: this.constructor.name,
                metadata: { message, messageId, correlationId },
            });
            throw new Error('Invalid message: missing messageId or jobId');
        }

        // Transactional Inbox
        const isNew = await this.dataSource.transaction(async (manager) => {
            return await this.inboxService.saveInTransaction(
                manager,
                messageId,
                message.jobId,
            );
        });

        if (!isNew) {
            this.logger.warn({
                message: 'Duplicate message detected, skipping',
                context: this.constructor.name,
                metadata: { messageId, jobId: message.jobId },
            });
            return;
        }

        return await this.observability.runInSpan(
            `workflow.job.consume.${config.queue}`,
            async (span) => {
                span.setAttributes({
                    'workflow.job.id': message.jobId,
                    'workflow.correlation.id': correlationId,
                    'workflow.queue': config.queue,
                });

                try {
                    await this.jobProcessor.process(message.jobId);

                    this.logger.log({
                        message: 'Workflow job processed successfully',
                        context: this.constructor.name,
                        metadata: { messageId, jobId: message.jobId },
                    });
                } catch (error) {
                    span.setAttributes({
                        'error': true,
                        'exception.type': error.name,
                    });

                    this.logger.error({
                        message: 'Failed to process workflow job',
                        context: this.constructor.name,
                        error,
                        metadata: { messageId, jobId: message.jobId },
                    });

                    throw error;
                }
            },
            {
                'workflow.component': 'consumer',
                'workflow.queue': config.queue,
            },
        );
    }
}
```

### 2. Consumer Específico por Workflow

```typescript
// worker/consumers/code-review.consumer.ts

import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { BaseWorkflowConsumer } from '../shared/base-workflow-consumer.abstract';
import {
    QUEUE_CONFIG,
    WORKFLOW_QUEUE_CONFIG,
} from '../../config/queue.constants';

@Injectable()
export class CodeReviewConsumer extends BaseWorkflowConsumer {
    protected getQueueConfig() {
        return {
            queue: QUEUE_CONFIG.CODE_REVIEW_QUEUE,
            routingKey: QUEUE_CONFIG.CODE_REVIEW_ROUTING_KEY,
            exchange: QUEUE_CONFIG.EXCHANGE,
        };
    }

    @RabbitSubscribe({
        exchange: QUEUE_CONFIG.EXCHANGE,
        routingKey: QUEUE_CONFIG.CODE_REVIEW_ROUTING_KEY,
        queue: QUEUE_CONFIG.CODE_REVIEW_QUEUE,
        createQueueIfNotExists: false,
        queueOptions: {
            durable: true,
            arguments: {
                'x-queue-type': 'quorum',
                'x-dead-letter-exchange': QUEUE_CONFIG.DEAD_LETTER_EXCHANGE,
                'x-delivery-limit':
                    WORKFLOW_QUEUE_CONFIG.CODE_REVIEW.retryLimit,
            },
        },
    })
    async handleCodeReviewJob(message: any, amqpMsg: any) {
        return super.handleWorkflowJob(message, amqpMsg);
    }
}
```

### 3. Service de Enfileiramento Inteligente

```typescript
// api/rabbitmq-job-queue.service.ts

import { Injectable, Inject, Optional } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { IJobQueueService } from '@/core/domain/workflowQueue/contracts/job-queue.service.contract';
import { IWorkflowJob } from '@/core/domain/workflowQueue/interfaces/workflow-job.interface';
import { WorkflowJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/workflow-job.repository';
import { TransactionalOutboxService } from '../shared/transactional-outbox.service';
import { DataSource } from 'typeorm';
import { QUEUE_CONFIG, WORKFLOW_QUEUE_CONFIG } from '../config/queue.constants';
import { WorkflowType } from '@/core/domain/workflowQueue/enums/workflow-type.enum';

@Injectable()
export class RabbitMQJobQueueService implements IJobQueueService {
    private readonly exchange = QUEUE_CONFIG.EXCHANGE;

    constructor(
        @Optional() private readonly amqpConnection: AmqpConnection,
        private readonly jobRepository: WorkflowJobRepository,
        private readonly outboxService: TransactionalOutboxService,
        private readonly dataSource: DataSource,
        // ... outros
    ) {}

    async enqueue(
        job: Omit<IWorkflowJob, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<string> {
        // Resolve configuração do workflow
        const workflowConfig = this.getWorkflowConfig(job.workflowType);

        const savedJob = await this.dataSource.transaction(async (manager) => {
            const jobToSave = await this.jobRepository.create(job);

            await this.outboxService.saveInTransaction(manager, {
                jobId: jobToSave.id,
                exchange: this.exchange,
                routingKey: workflowConfig.routingKey, // ✅ Routing key específico
                payload: {
                    jobId: jobToSave.id,
                    correlationId: job.correlationId,
                    workflowType: job.workflowType,
                    handlerType: job.handlerType,
                    organizationId: job.organizationAndTeam?.organizationId,
                    teamId: job.organizationAndTeam?.teamId,
                },
            });

            return jobToSave;
        });

        return savedJob.id;
    }

    private getWorkflowConfig(workflowType: WorkflowType) {
        switch (workflowType) {
            case WorkflowType.CODE_REVIEW:
                return WORKFLOW_QUEUE_CONFIG.CODE_REVIEW;
            case WorkflowType.WEBHOOK_PROCESSING:
                return WORKFLOW_QUEUE_CONFIG.WEBHOOK_PROCESSING;
            case WorkflowType.AST_TASK:
                return WORKFLOW_QUEUE_CONFIG.AST_TASK;
            default:
                throw new Error(`Unknown workflow type: ${workflowType}`);
        }
    }

    async enqueue(
        job: Omit<IWorkflowJob, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<string> {
        // Backpressure: verificar se fila está cheia
        if (QUEUE_RESILIENCE_CONFIG.backpressureEnabled) {
            const queueSize = await this.getQueueSize();
            if (queueSize >= QUEUE_RESILIENCE_CONFIG.backpressureThreshold) {
                throw new Error(
                    `Queue is full (${queueSize} jobs). Backpressure activated.`,
                );
            }
        }

        // Rate limiting por organização
        if (
            QUEUE_RESILIENCE_CONFIG.rateLimitEnabled &&
            job.organizationAndTeam?.organizationId
        ) {
            const workflowConfig = this.getWorkflowConfig(job.workflowType);
            const canEnqueue = await this.checkRateLimit(
                job.organizationAndTeam.organizationId,
                workflowConfig.rateLimitPerOrg,
            );
            if (!canEnqueue) {
                throw new Error(
                    `Rate limit exceeded for organization ${job.organizationAndTeam.organizationId}`,
                );
            }
        }

        // Continuar com enfileiramento normal...
        // ... resto do código
    }
}
```

---

## 📊 Comparação: Opção A vs Opção B

| Aspecto                 | Opção A (Single Queue) | Opção B (Queue por Type) ⭐ |
| ----------------------- | ---------------------- | --------------------------- |
| **Isolamento**          | ❌ Nenhum              | ✅ Total                    |
| **Escalabilidade**      | ❌ Limitada            | ✅ Independente             |
| **Performance**         | ⚠️ Média               | ✅ Otimizada                |
| **Debugging**           | ❌ Difícil             | ✅ Fácil                    |
| **Manutenabilidade**    | ⚠️ Média               | ✅ Alta                     |
| **Retry Policies**      | ❌ Única               | ✅ Por workflow             |
| **Resource Allocation** | ❌ Não                 | ✅ Sim                      |
| **Monitoring**          | ⚠️ Agregado            | ✅ Por workflow             |
| **Complexidade**        | ✅ Baixa               | ⚠️ Média                    |
| **Overhead**            | ✅ Baixo               | ⚠️ Médio                    |

---

## 🎯 Recomendação Final

### Use **Opção B (Queue por Workflow Type)** porque:

1. ✅ **Você já tem workflows diferentes** com características distintas
2. ✅ **Necessita escalar independentemente** (webhooks vs code reviews)
3. ✅ **Produção em escala** requer isolamento
4. ✅ **Manutenabilidade** é crítica para crescimento
5. ✅ **Performance** otimizada por workflow

### Implementação Gradual:

1. **Fase 1**: Criar estrutura base (config, api, worker)
2. **Fase 2**: Migrar CODE_REVIEW para queue própria
3. **Fase 3**: Migrar WEBHOOK_PROCESSING para queue própria
4. **Fase 4**: Migrar outros workflows
5. **Fase 5**: Remover queue genérica

---

## 📝 Próximos Passos

1. ✅ Validar arquitetura proposta
2. ✅ Criar estrutura de pastas
3. ✅ Implementar consumer base abstrato
4. ✅ Migrar workflows gradualmente
5. ✅ Monitorar performance e ajustar

---

## 🔗 Referências

- [RabbitMQ Best Practices](https://www.rabbitmq.com/best-practices.html)
- [Queue Isolation Patterns](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html)
- [Microservices Patterns: Message Queues](https://microservices.io/patterns/data/transactional-outbox.html)
