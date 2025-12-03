# Logging no Webhook Handler com Hono

## 🎯 Resposta Direta

**Opções de Logging**:

1. **Pino direto** (Recomendado - mais leve) ✅
2. **PinoLoggerService** (Reutilizar do projeto - mais pesado)
3. **Console.log** (Desenvolvimento apenas)

---

## 📊 Comparação: Opções de Logging

| Opção                 | Peso    | Performance | Estrutura        | Recomendado             |
| --------------------- | ------- | ----------- | ---------------- | ----------------------- |
| **Pino direto**       | ~2MB    | ⭐⭐⭐⭐⭐  | JSON estruturado | ✅ Sim                  |
| **PinoLoggerService** | ~5-10MB | ⭐⭐⭐⭐    | JSON estruturado | ⚠️ Se quiser reutilizar |
| **Console.log**       | 0MB     | ⭐⭐⭐      | Texto simples    | ❌ Apenas dev           |

---

## 💡 Opção 1: Pino Direto (Recomendado) ✅

### Instalação

```bash
yarn add pino pino-pretty
```

### Configuração

```typescript
// src/webhook-handler-hono/logger.ts
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
        ? {
              target: 'pino-pretty',
              options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss Z',
                  ignore: 'pid,hostname',
              },
          }
        : undefined,
    base: {
        component: 'webhook-handler',
    },
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});
```

### Uso no Entry Point

```typescript
// src/webhook-handler-hono.ts
import { logger } from './webhook-handler-hono/logger';

async function initialize() {
    logger.info({ message: 'Initializing webhook handler...' });

    await connectRabbitMQ();
    logger.info({ message: 'RabbitMQ connected' });

    await createDataSource();
    logger.info({ message: 'Database connected' });

    logger.info({ message: 'Initialization complete' });
}

// Error handlers
process.on('uncaughtException', (error) => {
    logger.error({
        message: 'Uncaught Exception',
        error: {
            message: error.message,
            stack: error.stack,
        },
    });
    process.exit(1);
});
```

### Uso nas Routes

```typescript
// src/webhook-handler-hono/routes/github.ts
import { logger } from '../logger';

githubWebhook.post('/webhook', async (c) => {
    const signature = c.req.header('x-hub-signature-256');
    const event = c.req.header('x-github-event');
    const body = await c.req.json();

    logger.debug({
        message: 'GitHub webhook received',
        metadata: {
            event,
            repository: body.repository?.name,
            pullRequestNumber: body.pull_request?.number,
        },
    });

    // Validar signature
    if (!validateGitHubSignature(signature, body)) {
        logger.warn({
            message: 'Invalid GitHub signature',
            metadata: {
                event,
                repository: body.repository?.name,
            },
        });
        return c.json({ error: 'Invalid signature' }, 401);
    }

    // Enfileirar job
    try {
        const jobId = await jobEnqueueService.enqueue({...});

        logger.info({
            message: 'GitHub webhook job enqueued',
            metadata: {
                jobId,
                event,
                repository: body.repository?.name,
                pullRequestNumber: body.pull_request?.number,
            },
        });

        return c.json({ jobId }, 202);
    } catch (error) {
        logger.error({
            message: 'Failed to enqueue GitHub webhook job',
            error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            },
            metadata: {
                event,
                repository: body.repository?.name,
            },
        });
        return c.json({ error: 'Failed to enqueue job' }, 500);
    }
});
```

### Uso no Cliente RabbitMQ

```typescript
// src/webhook-handler-hono/rabbitmq-client.ts
import { logger } from './logger';

export async function connectRabbitMQ(): Promise<void> {
    const rabbitMQEnabled = process.env.API_RABBITMQ_ENABLED === 'true';

    if (!rabbitMQEnabled) {
        logger.warn({ message: 'RabbitMQ is disabled' });
        return;
    }

    const uri = process.env.API_RABBITMQ_URI || 'amqp://localhost:5672/';

    try {
        logger.debug({
            message: 'Connecting to RabbitMQ',
            metadata: { uri: uri.replace(/:[^:]*@/, ':****@') },
        });

        connection = await amqp.connect(uri, {
            heartbeat: 60,
        });

        connection.on('error', (err) => {
            logger.error({
                message: 'RabbitMQ connection error',
                error: {
                    message: err.message,
                    stack: err.stack,
                },
            });
        });

        connection.on('close', () => {
            logger.warn({ message: 'RabbitMQ connection closed' });
            channel = null;
        });

        channel = await connection.createChannel();
        await channel.assertExchange('workflow.exchange', 'topic', {
            durable: true,
        });

        logger.info({ message: 'RabbitMQ connected and exchange asserted' });
    } catch (error) {
        logger.error({
            message: 'Failed to connect to RabbitMQ',
            error: {
                message:
                    error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            },
        });
        throw error;
    }
}

export async function publishJob(
    jobId: string,
    workflowType: string,
    payload: any,
): Promise<void> {
    if (!channel) {
        logger.error({ message: 'RabbitMQ channel not initialized' });
        throw new Error('RabbitMQ channel not initialized');
    }

    const routingKey = `workflow.jobs.created.${workflowType.toLowerCase()}`;

    try {
        const published = channel.publish(
            'workflow.exchange',
            routingKey,
            Buffer.from(JSON.stringify(message)),
            {
                persistent: true,
                messageId: jobId,
                correlationId: payload.correlationId,
                timestamp: Date.now(),
                contentType: 'application/json',
            },
        );

        if (!published) {
            logger.error({
                message: 'Failed to publish message to RabbitMQ',
                metadata: { jobId, routingKey },
            });
            throw new Error('Failed to publish message to RabbitMQ');
        }

        logger.debug({
            message: 'Job published to RabbitMQ',
            metadata: {
                jobId,
                routingKey,
                workflowType,
            },
        });
    } catch (error) {
        logger.error({
            message: 'Error publishing job to RabbitMQ',
            error: {
                message:
                    error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            },
            metadata: { jobId, routingKey },
        });
        throw error;
    }
}
```

### Uso no Serviço de Enfileiramento

```typescript
// src/webhook-handler-hono/job-enqueue-service.ts
import { logger } from './logger';

export class JobEnqueueService {
    async enqueue(input: EnqueueJobInput): Promise<string> {
        const correlationId = uuid();

        logger.debug({
            message: 'Enqueuing job',
            metadata: {
                workflowType: input.workflowType,
                handlerType: input.handlerType,
                organizationId: input.organizationId,
                teamId: input.teamId,
                correlationId,
            },
        });

        try {
            const savedJob = await this.dataSource.transaction(
                async (manager) => {
                    // ... salvar job e outbox
                },
            );

            logger.info({
                message: 'Job enqueued successfully',
                metadata: {
                    jobId: savedJob.id,
                    correlationId,
                    workflowType: input.workflowType,
                },
            });

            // Publicar na fila RabbitMQ
            try {
                await publishJob(savedJob.id, input.workflowType, {
                    correlationId,
                    workflowType: input.workflowType,
                    handlerType: input.handlerType,
                    organizationId: input.organizationId,
                    teamId: input.teamId,
                });
            } catch (error) {
                logger.warn({
                    message:
                        'Failed to publish to RabbitMQ, will be published by OutboxRelayService',
                    error: {
                        message:
                            error instanceof Error
                                ? error.message
                                : 'Unknown error',
                    },
                    metadata: { jobId: savedJob.id },
                });
                // Não falha a requisição - OutboxRelayService vai publicar depois
            }

            return savedJob.id;
        } catch (error) {
            logger.error({
                message: 'Failed to enqueue job',
                error: {
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                },
                metadata: {
                    workflowType: input.workflowType,
                    correlationId,
                },
            });
            throw error;
        }
    }
}
```

### Integração com Hono Logger Middleware

```typescript
// src/webhook-handler-hono.ts
import { logger } from './webhook-handler-hono/logger';
import { pinoLogger } from 'hono-pino';

// Middleware de logging HTTP
app.use(
    '*',
    pinoLogger({
        pino: logger,
        http: {
            reqId: () => crypto.randomUUID(),
        },
    }),
);

// Ou usar logger customizado
app.use('*', async (c, next) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();

    logger.info({
        message: 'HTTP request received',
        metadata: {
            method: c.req.method,
            path: c.req.path,
            requestId,
        },
    });

    await next();

    const duration = Date.now() - start;

    logger.info({
        message: 'HTTP request completed',
        metadata: {
            method: c.req.method,
            path: c.req.path,
            status: c.res.status,
            duration,
            requestId,
        },
    });
});
```

---

## 💡 Opção 2: PinoLoggerService (Reutilizar do Projeto)

### Instalação

```bash
# Não precisa instalar nada - já existe no projeto
```

### Configuração

```typescript
// src/webhook-handler-hono/logger-service.ts
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';

// Criar instância manualmente (sem NestJS DI)
const loggerService = new PinoLoggerService();

export { loggerService as logger };
```

### Uso

```typescript
// Mesmo uso do PinoLoggerService do projeto
logger.log({
    message: 'GitHub webhook received',
    context: 'GitHubWebhook',
    metadata: {
        event,
        repository: body.repository?.name,
    },
});

logger.error({
    message: 'Failed to enqueue job',
    context: 'JobEnqueueService',
    error,
    metadata: { jobId },
});
```

**Desvantagem**: Mais pesado (carrega dependências do NestJS)

---

## 💡 Opção 3: Console.log (Apenas Desenvolvimento)

```typescript
// src/webhook-handler-hono/logger.ts
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
    debug: (...args: unknown[]) =>
        isDevelopment && console.debug('[DEBUG]', ...args),
    info: (...args: unknown[]) => console.log('[INFO]', ...args),
    warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
    error: (...args: unknown[]) => console.error('[ERROR]', ...args),
};
```

**Não recomendado para produção** - sem estrutura, difícil de parsear

---

## 📊 Exemplo Completo: Logging Estruturado

### Formato de Log (JSON)

```json
{
    "level": "info",
    "time": "2024-01-15T10:30:45.123Z",
    "component": "webhook-handler",
    "message": "GitHub webhook job enqueued",
    "metadata": {
        "jobId": "550e8400-e29b-41d4-a716-446655440000",
        "event": "pull_request",
        "repository": "kodus-ai",
        "pullRequestNumber": 123,
        "correlationId": "abc-123-def"
    }
}
```

### Níveis de Log

- **debug**: Informações detalhadas (desenvolvimento)
- **info**: Informações gerais (webhooks recebidos, jobs enfileirados)
- **warn**: Avisos (signatures inválidas, conexões fechadas)
- **error**: Erros (falhas ao enfileirar, erros de conexão)

### Contextos Recomendados

- `webhook-handler`: Entry point
- `rabbitmq-client`: Cliente RabbitMQ
- `database`: Database operations
- `job-enqueue-service`: Serviço de enfileiramento
- `github-webhook`: Route GitHub
- `gitlab-webhook`: Route GitLab
- `bitbucket-webhook`: Route Bitbucket
- `azure-repos-webhook`: Route Azure Repos

---

## 🔧 Configuração de Variáveis de Ambiente

```bash
# Logging
LOG_LEVEL=info                    # debug, info, warn, error
NODE_ENV=production               # development, production

# Para desenvolvimento (pretty print)
NODE_ENV=development
```

---

## 📋 Exemplo Completo: Entry Point com Logging

```typescript
// src/webhook-handler-hono.ts
import 'source-map-support/register';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from './webhook-handler-hono/logger';
import {
    connectRabbitMQ,
    closeRabbitMQ,
} from './webhook-handler-hono/rabbitmq-client';
import {
    createDataSource,
    closeDataSource,
} from './webhook-handler-hono/database';
import { githubWebhook } from './webhook-handler-hono/routes/github';
import { gitlabWebhook } from './webhook-handler-hono/routes/gitlab';
import { bitbucketWebhook } from './webhook-handler-hono/routes/bitbucket';
import { azureReposWebhook } from './webhook-handler-hono/routes/azure-repos';

const app = new Hono();

// Middleware de logging HTTP
app.use('*', async (c, next) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();

    logger.debug({
        message: 'HTTP request received',
        metadata: {
            method: c.req.method,
            path: c.req.path,
            requestId,
        },
    });

    await next();

    const duration = Date.now() - start;

    logger.info({
        message: 'HTTP request completed',
        metadata: {
            method: c.req.method,
            path: c.req.path,
            status: c.res.status,
            duration,
            requestId,
        },
    });
});

// Routes
app.route('/github', githubWebhook);
app.route('/gitlab', gitlabWebhook);
app.route('/bitbucket', bitbucketWebhook);
app.route('/azure-repos', azureReposWebhook);

// Health check
app.get('/health', (c) => {
    logger.debug({ message: 'Health check requested' });
    return c.json({
        status: 'ok',
        component: 'webhook-handler',
        timestamp: new Date().toISOString(),
    });
});

// Inicialização
let initialized = false;

async function initialize() {
    if (initialized) return;

    logger.info({ message: 'Initializing webhook handler...' });

    try {
        await connectRabbitMQ();
        logger.info({ message: 'RabbitMQ connected' });

        await createDataSource();
        logger.info({ message: 'Database connected' });

        initialized = true;
        logger.info({ message: 'Initialization complete' });
    } catch (error) {
        logger.error({
            message: 'Failed to initialize webhook handler',
            error: {
                message:
                    error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            },
        });
        throw error;
    }
}

// Iniciar servidor
const port = parseInt(process.env.WEBHOOK_HANDLER_PORT || '3332', 10);
const host = process.env.WEBHOOK_HANDLER_HOST || '0.0.0.0';

initialize()
    .then(() => {
        serve(
            {
                fetch: app.fetch,
                port,
                hostname: host,
            },
            (info) => {
                logger.info({
                    message: 'Webhook handler started',
                    metadata: {
                        port: info.port,
                        address: info.address,
                    },
                });
            },
        );
    })
    .catch((error) => {
        logger.error({
            message: 'Failed to start webhook handler',
            error: {
                message:
                    error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            },
        });
        process.exit(1);
    });

// Graceful shutdown
const shutdown = async (signal: string) => {
    logger.info({ message: `Received ${signal}, shutting down gracefully...` });

    try {
        await closeRabbitMQ();
        await closeDataSource();
        logger.info({ message: 'Shutdown complete' });
        process.exit(0);
    } catch (error) {
        logger.error({
            message: 'Error during shutdown',
            error: {
                message:
                    error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            },
        });
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Error handlers
process.on('uncaughtException', (error) => {
    logger.error({
        message: 'Uncaught Exception',
        error: {
            message: error.message,
            stack: error.stack,
        },
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error({
        message: 'Unhandled Rejection',
        error: {
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
        },
    });
    process.exit(1);
});
```

---

## ✅ Resumo: Recomendação

### Opção Recomendada: Pino Direto ✅

**Por quê?**

- ✅ Leve (~2MB)
- ✅ Performance excelente
- ✅ Logs estruturados (JSON)
- ✅ Pretty print em desenvolvimento
- ✅ Não depende do NestJS

**Instalação**:

```bash
yarn add pino pino-pretty
```

**Uso**:

```typescript
import { logger } from './webhook-handler-hono/logger';

logger.info({
    message: 'GitHub webhook received',
    metadata: { event, repository },
});
```

---

## 📊 Comparação Final

| Aspecto          | Pino Direto | PinoLoggerService       | Console.log   |
| ---------------- | ----------- | ----------------------- | ------------- |
| **Peso**         | ~2MB        | ~5-10MB                 | 0MB           |
| **Performance**  | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐                | ⭐⭐⭐        |
| **Estrutura**    | JSON        | JSON                    | Texto         |
| **Pretty Print** | ✅ Sim      | ✅ Sim                  | ❌ Não        |
| **Dependências** | Mínimas     | NestJS                  | Nenhuma       |
| **Recomendado**  | ✅ Sim      | ⚠️ Se quiser reutilizar | ❌ Apenas dev |

---

## 💡 Próximos Passos

**Quer que eu implemente o logging com Pino direto?**

Posso criar:

1. ✅ `logger.ts` (configuração Pino)
2. ✅ Integrar em todos os arquivos
3. ✅ Middleware HTTP logging
4. ✅ Error handlers com logging
5. ✅ Atualizar exemplos
