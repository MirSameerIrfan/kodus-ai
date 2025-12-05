# Proposta de Organização do Módulo de Queue

## 📋 Análise da Estrutura Atual

### Problemas Identificados:

1. **Configuração Espalhada**:
    - RabbitMQ config está em `rabbitmq.module.ts` (hardcoded)
    - Constantes de exchange/queue estão hardcoded nos serviços
    - Não há separação entre configuração e uso

2. **Sem Separação API/Worker**:
    - `RabbitMQWrapperModule` é global e configura tudo
    - Não há diferenciação entre módulo para API (publisher) e Worker (consumer)
    - Todos os módulos carregam toda a infraestrutura

3. **Falta de Organização**:
    - Constantes espalhadas nos serviços
    - Configuração misturada com lógica de negócio
    - Difícil de manter e testar

---

## ✅ Proposta de Organização (Baseada no Exemplo)

### Estrutura Proposta:

```
src/core/infrastructure/adapters/services/workflowQueue/
├── config/
│   ├── queue-config.module.ts          # Módulo global de configuração
│   ├── queue.constants.ts              # Constantes e runtime config
│   ├── rabbit.constants.ts             # Tokens de injeção
│   └── rabbit.config.ts                # Loader de configuração
├── api/
│   ├── queue.module.api.ts             # Módulo para API (publisher apenas)
│   └── rabbitmq-job-queue.service.ts   # Serviço de dispatch (move para api/)
├── worker/
│   ├── queue.module.worker.ts          # Módulo para Worker (consumer)
│   ├── workflow-job-consumer.service.ts
│   ├── workflow-resumed-consumer.service.ts
│   └── ast-event-handler.service.ts
├── shared/
│   ├── transactional-outbox.service.ts
│   ├── transactional-inbox.service.ts
│   ├── outbox-relay.service.ts
│   ├── error-classifier.service.ts
│   ├── job-status.service.ts
│   └── code-review-job-processor.service.ts
└── definitions/
    └── workflow-queue.definition.ts    # Definições de topologia
```

---

## 📝 Arquivos Propostos

### 1. `config/queue.constants.ts`

```typescript
import { getEnvVariable, getEnvVariableAsNumber } from '@/shared/utils/env';

// Queue configuration versioning
export const QUEUE_CONFIG_VERSION = 'v1.0.0';

// Queue configuration constants
export const QUEUE_CONFIG = {
    // Delivery limits
    DELIVERY_LIMIT: 3,

    // Queue types
    QUEUE_TYPE: 'quorum',

    // Exchanges
    EXCHANGE: 'workflow.exchange',
    DEAD_LETTER_EXCHANGE: 'workflow.exchange.dlx',
    DELAYED_EXCHANGE: 'orchestrator.exchange.delayed',
    EVENTS_EXCHANGE: 'workflow.events',

    // Queues
    JOBS_QUEUE: 'workflow.jobs.queue',
    JOBS_RESUMED_QUEUE: 'workflow.jobs.resumed.queue',
    DEAD_LETTER_QUEUE: 'workflow.dlx.queue',
    EVENTS_AST_QUEUE: 'workflow.events.ast',

    // Routing keys
    JOBS_ROUTING_KEY: 'workflow.jobs.created',
    JOBS_RESUMED_ROUTING_KEY: 'workflow.jobs.resumed',
    EVENTS_AST_ROUTING_KEY: 'ast.task.completed',
} as const;

// Runtime configuration with feature flags
export function getQueueRuntimeConfig() {
    const enableExperimentalFeatures =
        (getEnvVariable('RABBIT_EXPERIMENTAL') ?? 'false') === 'true';

    return {
        version: QUEUE_CONFIG_VERSION,
        enableSingleActiveConsumer:
            (getEnvVariable('RABBIT_SAC') ?? 'false') === 'true',
        retryTtlMs: Number(getEnvVariable('RABBIT_RETRY_TTL_MS') ?? '60000'),
        prefetch: Number(getEnvVariable('RABBIT_PREFETCH') ?? '1'), // Fallback genérico
        publishTimeoutMs: Number(
            getEnvVariable('RABBIT_PUBLISH_TIMEOUT_MS') ?? '5000',
        ),
        enableExperimentalFeatures,
        enableEnhancedRetry:
            enableExperimentalFeatures &&
            (getEnvVariable('RABBIT_ENHANCED_RETRY') ?? 'false') === 'true',
        enableQueueMonitoring:
            (getEnvVariable('RABBIT_QUEUE_MONITORING') ?? 'true') === 'true',
        // Resiliência
        backpressureThreshold: Number(
            getEnvVariable('QUEUE_BACKPRESSURE_THRESHOLD') ?? '10000',
        ),
        backpressureEnabled:
            (getEnvVariable('QUEUE_BACKPRESSURE_ENABLED') ?? 'true') === 'true',
        rateLimitEnabled:
            (getEnvVariable('QUEUE_RATE_LIMIT_ENABLED') ?? 'true') === 'true',
        priorityEnabled:
            (getEnvVariable('QUEUE_PRIORITY_ENABLED') ?? 'true') === 'true',
    };
}

// Configuração por Workflow Type (substitui prefetch genérico)
export const WORKFLOW_QUEUE_CONFIG = {
    CODE_REVIEW: {
        prefetch: 1,
        retryLimit: 3,
        retryDelay: 60000,
        timeout: 300000,
        rateLimitPerOrg: 10,
    },
    WEBHOOK_PROCESSING: {
        prefetch: 10,
        retryLimit: 5,
        retryDelay: 5000,
        timeout: 30000,
        rateLimitPerOrg: 50,
    },
    // ... outros workflows
} as const;

// Queue arguments builder
export function buildQueueArguments(
    options: {
        deadLetterExchange?: string;
        deliveryLimit?: number;
        singleActiveConsumer?: boolean;
        messageTtl?: number;
    } = {},
) {
    const args: Record<string, unknown> = {
        'x-queue-type': QUEUE_CONFIG.QUEUE_TYPE,
    };

    if (options.deadLetterExchange) {
        args['x-dead-letter-exchange'] = options.deadLetterExchange;
    }

    if (options.deliveryLimit) {
        args['x-delivery-limit'] = options.deliveryLimit;
    }

    if (options.singleActiveConsumer) {
        args['x-single-active-consumer'] = true;
    }

    if (options.messageTtl) {
        args['x-message-ttl'] = options.messageTtl;
    }

    return args;
}

// Consumer queue options builder
export function buildConsumerQueueOptions(
    options: {
        deadLetterExchange?: string;
        deliveryLimit?: number;
        singleActiveConsumer?: boolean;
    } = {},
) {
    return {
        channel: 'consumer' as const,
        durable: true,
        arguments: buildQueueArguments(options),
    };
}

// Build task queue options with runtime config
export function buildTaskQueueOptions(config: {
    enableSingleActiveConsumer: boolean;
}) {
    return buildConsumerQueueOptions({
        deadLetterExchange: QUEUE_CONFIG.DEAD_LETTER_EXCHANGE,
        deliveryLimit: QUEUE_CONFIG.DELIVERY_LIMIT,
        singleActiveConsumer: config.enableSingleActiveConsumer,
    });
}
```

### 2. `config/rabbit.constants.ts`

```typescript
export const RABBITMQ_CONFIG = Symbol('RABBITMQ_CONFIG');
```

### 3. `config/rabbit.config.ts`

```typescript
import { getEnvVariable, getEnvVariableAsNumber } from '@/shared/utils/env';

export interface RabbitMqConfig {
    enabled: boolean;
    url: string;
    retryQueue?: string;
    retryTtlMs?: number;
    prefetch: number;
    publishTimeoutMs: number;
    connectionName: string;
}

export function loadRabbitMqConfig(): RabbitMqConfig {
    const url = getEnvVariable('API_RABBITMQ_URI');
    const rabbitmqEnabled =
        getEnvVariable('API_RABBITMQ_ENABLED', 'true')?.toLowerCase() ===
        'true';

    if (!url || !rabbitmqEnabled) {
        return {
            enabled: false,
            url: '',
            retryQueue: getEnvVariable('RABBIT_RETRY_QUEUE'),
            retryTtlMs: getEnvVariableAsNumber('RABBIT_RETRY_TTL_MS', 60000),
            prefetch: getEnvVariableAsNumber('RABBIT_PREFETCH', 1) ?? 1,
            publishTimeoutMs:
                getEnvVariableAsNumber('RABBIT_PUBLISH_TIMEOUT_MS', 5000) ??
                5000,
            connectionName: 'kodus-workflow-queue',
        };
    }

    return {
        enabled: true,
        url,
        retryQueue: getEnvVariable('RABBIT_RETRY_QUEUE'),
        retryTtlMs: getEnvVariableAsNumber('RABBIT_RETRY_TTL_MS', 60000),
        prefetch: getEnvVariableAsNumber('RABBIT_PREFETCH', 1) ?? 1,
        publishTimeoutMs:
            getEnvVariableAsNumber('RABBIT_PUBLISH_TIMEOUT_MS', 5000) ?? 5000,
        connectionName: 'kodus-workflow-queue',
    };
}
```

### 4. `config/queue-config.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { RABBITMQ_CONFIG } from './rabbit.constants';
import { loadRabbitMqConfig } from './rabbit.config';

@Global()
@Module({
    providers: [
        {
            provide: RABBITMQ_CONFIG,
            useFactory: () => {
                return loadRabbitMqConfig();
            },
        },
    ],
    exports: [RABBITMQ_CONFIG],
})
export class QueueConfigModule {}
```

### 5. `api/queue.module.api.ts`

```typescript
import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { QueueConfigModule } from '../config/queue-config.module';
import { QUEUE_CONFIG } from '../config/queue.constants';
import { RABBITMQ_CONFIG } from '../config/rabbit.constants';
import type { RabbitMqConfig } from '../config/rabbit.config';
import { RabbitMQJobQueueService } from './rabbitmq-job-queue.service';
import { JOB_QUEUE_SERVICE_TOKEN } from '@/core/domain/workflowQueue/contracts/job-queue.service.contract';

@Module({
    imports: [
        QueueConfigModule,
        // Só importa RabbitMQ se estiver habilitado
        ...(process.env.API_RABBITMQ_ENABLED !== 'false'
            ? [
                  RabbitMQModule.forRootAsync({
                      imports: [QueueConfigModule],
                      inject: [RABBITMQ_CONFIG],
                      useFactory: (cfg: RabbitMqConfig) => ({
                          name: cfg.connectionName,
                          uri: cfg.url,
                          prefetchCount: 0, // publisher não consome
                          exchanges: [
                              {
                                  name: QUEUE_CONFIG.EXCHANGE,
                                  type: 'topic',
                                  createExchangeIfNotExists: false,
                                  options: { durable: true },
                              },
                              {
                                  name: QUEUE_CONFIG.DEAD_LETTER_EXCHANGE,
                                  type: 'topic',
                                  createExchangeIfNotExists: false,
                                  options: { durable: true },
                              },
                              {
                                  name: QUEUE_CONFIG.DELAYED_EXCHANGE,
                                  type: 'x-delayed-message',
                                  createExchangeIfNotExists: false, // ✅ Assume que já existe via definitions.json
                                  options: {
                                      durable: true,
                                      arguments: { 'x-delayed-type': 'direct' },
                                  },
                              },
                              {
                                  name: QUEUE_CONFIG.EVENTS_EXCHANGE,
                                  type: 'topic',
                                  createExchangeIfNotExists: false, // ✅ Assume que já existe via definitions.json
                                  options: { durable: true },
                              },
                          ],
                          // ✅ Exchanges são criados via definitions.json (não via código)
                          registerHandlers: false, // API não consome
                          enableDirectReplyTo: false,
                          connectionInitOptions: {
                              wait: true,
                              timeout: 10_000,
                              reject: true,
                          },
                          connectionManagerOptions: {
                              heartbeatIntervalInSeconds: 30,
                              reconnectTimeInSeconds: 5,
                              connectionOptions: {
                                  clientProperties: {
                                      connection_name: cfg.connectionName,
                                  },
                              },
                          },
                      }),
                  }),
              ]
            : []),
    ],
    providers: [
        // Só cria RabbitMQJobQueueService se RabbitMQ estiver habilitado
        ...(process.env.API_RABBITMQ_ENABLED !== 'false'
            ? [
                  RabbitMQJobQueueService,
                  {
                      provide: JOB_QUEUE_SERVICE_TOKEN,
                      useExisting: RabbitMQJobQueueService,
                  },
              ]
            : [
                  // Mock service quando RabbitMQ estiver desabilitado
                  {
                      provide: JOB_QUEUE_SERVICE_TOKEN,
                      useValue: {
                          enqueue: async () => {
                              console.log(
                                  'RabbitMQ disabled, skipping job enqueue',
                              );
                          },
                      },
                  },
              ]),
    ],
    exports: [JOB_QUEUE_SERVICE_TOKEN],
})
export class QueueModuleApi {}
```

### 6. `worker/queue.module.worker.ts`

```typescript
import { Module } from '@nestjs/common';
import {
    RabbitMQModule,
    MessageHandlerErrorBehavior,
} from '@golevelup/nestjs-rabbitmq';
import { QueueConfigModule } from '../config/queue-config.module';
import { RABBITMQ_CONFIG } from '../config/rabbit.constants';
import type { RabbitMqConfig } from '../config/rabbit.config';
import { QUEUE_CONFIG, getQueueRuntimeConfig } from '../config/queue.constants';
import { WorkflowJobConsumer } from './workflow-job-consumer.service';
import { WorkflowResumedConsumer } from './workflow-resumed-consumer.service';
import { ASTEventHandler } from './ast-event-handler.service';

const runtime = getQueueRuntimeConfig();

@Module({
    imports: [
        QueueConfigModule,
        // Só importa RabbitMQ se estiver habilitado
        ...(process.env.API_RABBITMQ_ENABLED !== 'false'
            ? [
                  RabbitMQModule.forRootAsync({
                      imports: [QueueConfigModule],
                      inject: [RABBITMQ_CONFIG],
                      useFactory: (cfg: RabbitMqConfig) => ({
                          name: cfg.connectionName,
                          uri: cfg.url,
                          prefetchCount: runtime.prefetch,
                          channels: {
                              consumer: {
                                  prefetchCount: runtime.prefetch,
                                  default: true,
                              },
                          },
                          exchanges: [
                              {
                                  name: QUEUE_CONFIG.EXCHANGE,
                                  type: 'topic',
                                  createExchangeIfNotExists: false,
                                  options: { durable: true },
                              },
                              {
                                  name: QUEUE_CONFIG.DEAD_LETTER_EXCHANGE,
                                  type: 'topic',
                                  createExchangeIfNotExists: false,
                                  options: { durable: true },
                              },
                              {
                                  name: QUEUE_CONFIG.DELAYED_EXCHANGE,
                                  type: 'x-delayed-message',
                                  createExchangeIfNotExists: false,
                                  options: {
                                      durable: true,
                                      arguments: { 'x-delayed-type': 'direct' },
                                  },
                              },
                              {
                                  name: QUEUE_CONFIG.EVENTS_EXCHANGE,
                                  type: 'topic',
                                  createExchangeIfNotExists: false,
                                  options: { durable: true },
                              },
                          ],
                          // Queues são criadas via definitions.json ou manualmente
                          registerHandlers: true,
                          defaultSubscribeErrorBehavior:
                              MessageHandlerErrorBehavior.NACK,
                          enableDirectReplyTo: false,
                          connectionInitOptions: {
                              wait: true,
                              timeout: 10_000,
                              reject: true,
                          },
                          connectionManagerOptions: {
                              heartbeatIntervalInSeconds: 30,
                              reconnectTimeInSeconds: 5,
                              connectionOptions: {
                                  clientProperties: {
                                      connection_name: cfg.connectionName,
                                  },
                              },
                          },
                      }),
                  }),
              ]
            : []),
    ],
    providers: [
        ...(process.env.API_RABBITMQ_ENABLED !== 'false'
            ? [WorkflowJobConsumer, WorkflowResumedConsumer, ASTEventHandler]
            : []),
    ],
})
export class QueueModuleWorker {}
```

### 7. `definitions/workflow-queue.definition.ts`

```typescript
import { QUEUE_CONFIG } from '../config/queue.constants';

export interface QueueBinding {
    type: string;
    queue: string;
    routingKey: string;
}

export const WORKFLOW_QUEUE_BINDINGS: ReadonlyArray<QueueBinding> = [
    {
        type: 'CODE_REVIEW',
        queue: QUEUE_CONFIG.JOBS_QUEUE,
        routingKey: `${QUEUE_CONFIG.JOBS_ROUTING_KEY}.code_review`,
    },
    {
        type: 'WEBHOOK_PROCESSING',
        queue: QUEUE_CONFIG.JOBS_QUEUE,
        routingKey: `${QUEUE_CONFIG.JOBS_ROUTING_KEY}.webhook_processing`,
    },
];

/**
 * Helper para resolver routing key baseado no tipo de workflow
 */
export function resolveRoutingKey(workflowType: string): string {
    const binding = WORKFLOW_QUEUE_BINDINGS.find(
        (b) => b.type === workflowType,
    );
    return (
        binding?.routingKey ||
        `${QUEUE_CONFIG.JOBS_ROUTING_KEY}.${workflowType.toLowerCase()}`
    );
}
```

**Nota**: A topologia (exchanges, queues, bindings) é criada via `definitions.json` quando o RabbitMQ sobe, não via código. O código apenas **usa** a topologia existente.

---

## 📄 `definitions.json` para RabbitMQ

A topologia do RabbitMQ é criada via `definitions.json` quando o serviço sobe. Isso é melhor que criar via código porque:

- ✅ **Declarativo**: Toda topologia em um arquivo versionável
- ✅ **Independente**: Não precisa da aplicação rodar para criar topologia
- ✅ **Multi-ambiente**: Mesmo arquivo pode ser usado em dev/staging/prod
- ✅ **Revisável**: Mudanças na topologia são fáceis de revisar

### Exemplo: `definitions.json` para kodus-ai

```json
{
    "rabbit_version": "4.2.1",
    "vhosts": [
        {
            "name": "kodus-ai"
        }
    ],
    "exchanges": [
        {
            "name": "workflow.exchange",
            "vhost": "kodus-ai",
            "type": "topic",
            "durable": true,
            "auto_delete": false,
            "internal": false,
            "arguments": {}
        },
        {
            "name": "workflow.exchange.dlx",
            "vhost": "kodus-ai",
            "type": "topic",
            "durable": true,
            "auto_delete": false,
            "internal": false,
            "arguments": {}
        },
        {
            "name": "orchestrator.exchange.delayed",
            "vhost": "kodus-ai",
            "type": "x-delayed-message",
            "durable": true,
            "auto_delete": false,
            "internal": false,
            "arguments": {
                "x-delayed-type": "direct"
            }
        },
        {
            "name": "workflow.events",
            "vhost": "kodus-ai",
            "type": "topic",
            "durable": true,
            "auto_delete": false,
            "internal": false,
            "arguments": {}
        }
    ],
    "queues": [
        {
            "name": "workflow.jobs.queue",
            "vhost": "kodus-ai",
            "durable": true,
            "auto_delete": false,
            "arguments": {
                "x-queue-type": "quorum",
                "x-dead-letter-exchange": "workflow.exchange.dlx",
                "x-dead-letter-routing-key": "workflow.job.failed",
                "x-delivery-limit": 3
            }
        },
        {
            "name": "workflow.jobs.resumed.queue",
            "vhost": "kodus-ai",
            "durable": true,
            "auto_delete": false,
            "arguments": {
                "x-queue-type": "quorum",
                "x-dead-letter-exchange": "workflow.exchange.dlx",
                "x-dead-letter-routing-key": "workflow.jobs.dlq",
                "x-delivery-limit": 3
            }
        },
        {
            "name": "workflow.dlx.queue",
            "vhost": "kodus-ai",
            "durable": true,
            "auto_delete": false,
            "arguments": {
                "x-queue-type": "quorum"
            }
        },
        {
            "name": "workflow.events.ast",
            "vhost": "kodus-ai",
            "durable": true,
            "auto_delete": false,
            "arguments": {
                "x-queue-type": "quorum"
            }
        },
        {
            "name": "dlx.queue",
            "vhost": "kodus-ai",
            "durable": true,
            "auto_delete": false,
            "arguments": {}
        },
        {
            "name": "codeReviewFeedback.syncCodeReviewReactions.queue",
            "vhost": "kodus-ai",
            "durable": true,
            "auto_delete": false,
            "arguments": {
                "x-dead-letter-exchange": "orchestrator.exchange.dlx",
                "x-dead-letter-routing-key": "codeReviewFeedback.syncCodeReviewReactions"
            }
        }
    ],
    "bindings": [
        {
            "source": "workflow.exchange.dlx",
            "vhost": "kodus-ai",
            "destination": "workflow.dlx.queue",
            "destination_type": "queue",
            "routing_key": "#",
            "arguments": {}
        },
        {
            "source": "workflow.exchange",
            "vhost": "kodus-ai",
            "destination": "workflow.jobs.queue",
            "destination_type": "queue",
            "routing_key": "workflow.jobs.created.*",
            "arguments": {}
        },
        {
            "source": "workflow.exchange",
            "vhost": "kodus-ai",
            "destination": "workflow.jobs.resumed.queue",
            "destination_type": "queue",
            "routing_key": "workflow.jobs.resumed",
            "arguments": {}
        },
        {
            "source": "workflow.events",
            "vhost": "kodus-ai",
            "destination": "workflow.events.ast",
            "destination_type": "queue",
            "routing_key": "ast.task.completed",
            "arguments": {}
        },
        {
            "source": "orchestrator.exchange.dlx",
            "vhost": "kodus-ai",
            "destination": "dlx.queue",
            "destination_type": "queue",
            "routing_key": "#",
            "arguments": {}
        },
        {
            "source": "orchestrator.exchange.delayed",
            "vhost": "kodus-ai",
            "destination": "codeReviewFeedback.syncCodeReviewReactions.queue",
            "destination_type": "queue",
            "routing_key": "codeReviewFeedback.syncCodeReviewReactions",
            "arguments": {}
        }
    ]
}
```

**Uso**:

```bash
# Ao subir RabbitMQ, passar o definitions.json
rabbitmq-server -detached
rabbitmqctl import_definitions /path/to/definitions.json
```

Ou via Docker:

```yaml
services:
    rabbitmq:
        image: rabbitmq:4.2.1-management
        volumes:
            - ./definitions.json:/etc/rabbitmq/definitions.json
        environment:
            RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS: -rabbitmq_management load_definitions /etc/rabbitmq/definitions.json
```

---

## 🔄 Migração Proposta

### Fase 1: Criar Estrutura Base

1. Criar `config/` com módulos de configuração
2. Criar `definitions/` com helpers de routing key
3. Mover constantes para `queue.constants.ts`
4. Criar/atualizar `definitions.json` com topologia completa

### Fase 2: Separar API e Worker

1. Criar `api/queue.module.api.ts` (substitui parte do `RabbitMQWrapperModule`)
2. Criar `worker/queue.module.worker.ts` (substitui parte do `RabbitMQWrapperModule`)
3. Mover `RabbitMQJobQueueService` para `api/`
4. **Importante**: Usar `createExchangeIfNotExists: false` e `createQueueIfNotExists: false` (assumir que já existe via definitions.json)

### Fase 3: Atualizar Módulos

1. `AppModule` importa `QueueModuleApi`
2. `WorkerModule` importa `QueueModuleWorker`
3. Remover criação de queues/exchanges do `RabbitMQWrapperModule` (ou simplificar para outros usos)

### Fase 4: Atualizar Serviços

1. Atualizar serviços para usar constantes de `queue.constants.ts`
2. Atualizar consumers para usar `QUEUE_CONFIG`
3. Remover qualquer código que cria topologia (assumir que já existe)

---

## ✅ Benefícios

1. **Separação Clara**: API (publisher) vs Worker (consumer)
2. **Configuração Centralizada**: Tudo em `config/`
3. **Fácil de Testar**: Mocks simples quando RabbitMQ desabilitado
4. **Manutenção**: Constantes em um só lugar
5. **Escalabilidade**: Fácil adicionar novas queues/exchanges
6. **Feature Flags**: Runtime config permite gradual rollout
7. **Configuração por Workflow Type**: Prefetch, retry, timeout otimizados por tipo de workflow
8. **Resiliência**: Rate limiting por organização, backpressure, circuit breaker, priorização básica

---

## ❓ Próximos Passos

1. Validar proposta com o time
2. Criar estrutura de pastas
3. Migrar código gradualmente
4. Testar em dev/staging
5. Documentar uso
