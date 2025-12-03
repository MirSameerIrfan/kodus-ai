# Exemplo Completo: Webhook Handler com Hono + amqplib

## 📁 Estrutura de Arquivos

```
src/
├── webhook-handler-hono.ts                    ← Entry point principal
└── webhook-handler-hono/
    ├── database.ts                            ← Configuração TypeORM
    ├── rabbitmq-client.ts                     ← Cliente RabbitMQ (amqplib)
    ├── job-enqueue-service.ts                 ← Serviço para enfileirar jobs
    ├── validators.ts                          ← Validação de signatures
    └── routes/
        ├── github.ts                          ← Route GitHub
        ├── gitlab.ts                          ← Route GitLab
        ├── bitbucket.ts                       ← Route Bitbucket
        └── azure-repos.ts                     ← Route Azure Repos
```

---

## 📄 Exemplo 1: Entry Point Principal

```typescript
// src/webhook-handler-hono.ts
import 'source-map-support/register';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { connectRabbitMQ, closeRabbitMQ } from './webhook-handler-hono/rabbitmq-client';
import { createDataSource, closeDataSource } from './webhook-handler-hono/database';
import { githubWebhook } from './webhook-handler-hono/routes/github';
import { gitlabWebhook } from './webhook-handler-hono/routes/gitlab';
import { bitbucketWebhook } from './webhook-handler-hono/routes/bitbucket';
import { azureReposWebhook } from './webhook-handler-hono/routes/azure-repos';

const app = new Hono();

// Middleware global
app.use('*', logger());
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

// Routes
app.route('/github', githubWebhook);
app.route('/gitlab', gitlabWebhook);
app.route('/bitbucket', bitbucketWebhook);
app.route('/azure-repos', azureReposWebhook);

// Health check
app.get('/health', (c) => {
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

    console.log('[WebhookHandler] - Initializing...');

    // Conectar RabbitMQ
    await connectRabbitMQ();
    console.log('[WebhookHandler] - RabbitMQ connected');

    // Conectar Database
    await createDataSource();
    console.log('[WebhookHandler] - Database connected');

    initialized = true;
    console.log('[WebhookHandler] - Initialization complete');
}

// Iniciar servidor
const port = parseInt(process.env.WEBHOOK_HANDLER_PORT || '3332', 10);
const host = process.env.WEBHOOK_HANDLER_HOST || '0.0.0.0';

initialize()
    .then(() => {
        serve({
            fetch: app.fetch,
            port,
            hostname: host,
        }, (info) => {
            console.log(`[WebhookHandler] - Ready on http://${info.address}:${info.port}`);
        });
    })
    .catch((error) => {
        console.error('[WebhookHandler] - Failed to initialize:', error);
        process.exit(1);
    });

// Graceful shutdown
const shutdown = async (signal: string) => {
    console.log(`[WebhookHandler] - Received ${signal}, shutting down gracefully...`);
    
    try {
        await closeRabbitMQ();
        await closeDataSource();
        console.log('[WebhookHandler] - Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('[WebhookHandler] - Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Error handlers
process.on('uncaughtException', (error) => {
    console.error('[WebhookHandler] - Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('[WebhookHandler] - Unhandled Rejection:', reason);
    process.exit(1);
});
```

---

## 📄 Exemplo 2: Cliente RabbitMQ (amqplib)

```typescript
// src/webhook-handler-hono/rabbitmq-client.ts
import amqp, { Connection, Channel } from 'amqplib';

let connection: Connection | null = null;
let channel: Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
    const rabbitMQEnabled = process.env.API_RABBITMQ_ENABLED === 'true';
    
    if (!rabbitMQEnabled) {
        console.warn('[RabbitMQ] - RabbitMQ is disabled');
        return;
    }

    const uri = process.env.API_RABBITMQ_URI || 'amqp://localhost:5672/';

    try {
        connection = await amqp.connect(uri, {
            heartbeat: 60,
        });

        connection.on('error', (err) => {
            console.error('[RabbitMQ] - Connection error:', err);
        });

        connection.on('close', () => {
            console.warn('[RabbitMQ] - Connection closed');
            channel = null;
        });

        channel = await connection.createChannel();

        // Garantir que exchange existe (não cria se já existir)
        await channel.assertExchange('workflow.exchange', 'topic', {
            durable: true,
        });

        console.log('[RabbitMQ] - Connected and exchange asserted');
    } catch (error) {
        console.error('[RabbitMQ] - Failed to connect:', error);
        throw error;
    }
}

export async function publishJob(
    jobId: string,
    workflowType: string,
    payload: {
        correlationId: string;
        workflowType: string;
        handlerType: string;
        organizationId: string;
        teamId: string;
    },
): Promise<void> {
    if (!channel) {
        throw new Error('RabbitMQ channel not initialized');
    }

    const routingKey = `workflow.jobs.created.${workflowType.toLowerCase()}`;
    const message = {
        jobId,
        correlationId: payload.correlationId,
        workflowType: payload.workflowType,
        handlerType: payload.handlerType,
        organizationId: payload.organizationId,
        teamId: payload.teamId,
    };

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
        throw new Error('Failed to publish message to RabbitMQ');
    }

    console.log(`[RabbitMQ] - Published job ${jobId} to ${routingKey}`);
}

export async function closeRabbitMQ(): Promise<void> {
    try {
        if (channel) {
            await channel.close();
            channel = null;
        }
        if (connection) {
            await connection.close();
            connection = null;
        }
        console.log('[RabbitMQ] - Closed connection');
    } catch (error) {
        console.error('[RabbitMQ] - Error closing connection:', error);
    }
}
```

---

## 📄 Exemplo 3: Configuração Database (TypeORM)

```typescript
// src/webhook-handler-hono/database.ts
import { DataSource } from 'typeorm';
import { WorkflowJobModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/workflow-job.model';
import { OutboxMessageModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/outbox-message.model';

let dataSource: DataSource | null = null;

export async function createDataSource(): Promise<DataSource> {
    if (dataSource?.isInitialized) {
        return dataSource;
    }

    const databaseUrl = process.env.API_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
        throw new Error('Database URL not configured');
    }

    dataSource = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        schema: 'workflow',
        entities: [WorkflowJobModel, OutboxMessageModel],
        synchronize: false, // Nunca usar synchronize em produção
        logging: process.env.NODE_ENV === 'development',
        extra: {
            max: 8, // Pool pequeno para webhook handler
            min: 1,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 2000,
        },
    });

    await dataSource.initialize();
    console.log('[Database] - Connected');

    return dataSource;
}

export function getDataSource(): DataSource {
    if (!dataSource?.isInitialized) {
        throw new Error('DataSource not initialized');
    }
    return dataSource;
}

export async function closeDataSource(): Promise<void> {
    if (dataSource?.isInitialized) {
        await dataSource.destroy();
        dataSource = null;
        console.log('[Database] - Closed connection');
    }
}
```

---

## 📄 Exemplo 4: Serviço para Enfileirar Jobs

```typescript
// src/webhook-handler-hono/job-enqueue-service.ts
import { DataSource } from 'typeorm';
import { WorkflowJobModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/workflow-job.model';
import { OutboxMessageModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/outbox-message.model';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
import { WorkflowType } from '@/core/domain/workflowQueue/enums/workflow-type.enum';
import { HandlerType } from '@/core/domain/workflowQueue/enums/handler-type.enum';
import { publishJob } from './rabbitmq-client';
import { v4 as uuid } from 'uuid';

export interface EnqueueJobInput {
    workflowType: WorkflowType;
    handlerType: HandlerType;
    payload: Record<string, unknown>;
    organizationId: string;
    teamId: string;
    priority?: number;
    maxRetries?: number;
}

export class JobEnqueueService {
    constructor(private readonly dataSource: DataSource) {}

    async enqueue(input: EnqueueJobInput): Promise<string> {
        const correlationId = uuid();

        // Usa Transactional Outbox pattern
        const savedJob = await this.dataSource.transaction(async (manager) => {
            // 1. Salva job no banco
            const jobRepo = manager.getRepository(WorkflowJobModel);
            const jobToSave = jobRepo.create({
                correlationId,
                workflowType: input.workflowType,
                handlerType: input.handlerType,
                payload: input.payload,
                organizationId: input.organizationId,
                teamId: input.teamId,
                status: JobStatus.PENDING,
                priority: input.priority || 0,
                retryCount: 0,
                maxRetries: input.maxRetries || 3,
            });
            const savedJob = await jobRepo.save(jobToSave);

            // 2. Salva mensagem no outbox (mesma transação)
            const outboxRepo = manager.getRepository(OutboxMessageModel);
            await outboxRepo.save({
                jobId: savedJob.id,
                exchange: 'workflow.exchange',
                routingKey: `workflow.jobs.created.${input.workflowType.toLowerCase()}`,
                payload: {
                    jobId: savedJob.id,
                    correlationId,
                    workflowType: input.workflowType,
                    handlerType: input.handlerType,
                    organizationId: input.organizationId,
                    teamId: input.teamId,
                },
                status: 'pending',
                retryCount: 0,
                maxRetries: 3,
            });

            return savedJob;
        });

        // 3. Publica na fila RabbitMQ (fora da transação)
        // Nota: Em produção, isso seria feito pelo OutboxRelayService no Worker
        // Mas para simplificar, podemos publicar diretamente aqui
        try {
            await publishJob(savedJob.id, input.workflowType, {
                correlationId,
                workflowType: input.workflowType,
                handlerType: input.handlerType,
                organizationId: input.organizationId,
                teamId: input.teamId,
            });
        } catch (error) {
            console.error('[JobEnqueueService] - Failed to publish to RabbitMQ:', error);
            // Não falha a requisição - OutboxRelayService vai publicar depois
        }

        return savedJob.id;
    }
}
```

---

## 📄 Exemplo 5: Validação de Signatures

```typescript
// src/webhook-handler-hono/validators.ts
import crypto from 'crypto';

export function validateGitHubSignature(
    signature: string | undefined,
    body: string | object,
): boolean {
    if (!signature) {
        return false;
    }

    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
        console.warn('[GitHub] - GITHUB_WEBHOOK_SECRET not configured');
        return false; // Ou true se não quiser validar em dev
    }

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(bodyString).digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest),
    );
}

export function validateGitLabSignature(
    token: string | undefined,
): boolean {
    if (!token) {
        return false;
    }

    const secret = process.env.GITLAB_WEBHOOK_SECRET;
    if (!secret) {
        console.warn('[GitLab] - GITLAB_WEBHOOK_SECRET not configured');
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(secret),
    );
}

export function validateBitbucketSignature(
    signature: string | undefined,
    body: string | object,
): boolean {
    if (!signature) {
        return false;
    }

    const secret = process.env.BITBUCKET_WEBHOOK_SECRET;
    if (!secret) {
        console.warn('[Bitbucket] - BITBUCKET_WEBHOOK_SECRET not configured');
        return false;
    }

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(bodyString).digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest),
    );
}

export function validateAzureReposToken(
    token: string | undefined,
): boolean {
    if (!token) {
        return false;
    }

    // Azure Repos usa token simples (não HMAC)
    const secret = process.env.AZURE_REPOS_WEBHOOK_SECRET;
    if (!secret) {
        console.warn('[AzureRepos] - AZURE_REPOS_WEBHOOK_SECRET not configured');
        return false;
    }

    return token === secret;
}
```

---

## 📄 Exemplo 6: Route GitHub

```typescript
// src/webhook-handler-hono/routes/github.ts
import { Hono } from 'hono';
import { validateGitHubSignature } from '../validators';
import { getDataSource } from '../database';
import { JobEnqueueService } from '../job-enqueue-service';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { WorkflowType } from '@/core/domain/workflowQueue/enums/workflow-type.enum';
import { HandlerType } from '@/core/domain/workflowQueue/enums/handler-type.enum';

export const githubWebhook = new Hono();

githubWebhook.post('/webhook', async (c) => {
    const signature = c.req.header('x-hub-signature-256');
    const event = c.req.header('x-github-event');
    const body = await c.req.json();

    // Validar signature
    if (!validateGitHubSignature(signature, body)) {
        return c.json({ error: 'Invalid signature' }, 401);
    }

    // Filtrar eventos não suportados
    if (event === 'pull_request') {
        const allowedActions = [
            'opened',
            'synchronize',
            'closed',
            'reopened',
            'ready_for_review',
        ];
        
        if (!allowedActions.includes(body?.action)) {
            return c.json('Event ignored', 200);
        }
    }

    // Extrair dados do webhook
    const repository = body.repository;
    const pullRequest = body.pull_request || body;
    const installation = body.installation;

    if (!repository || !pullRequest) {
        return c.json({ error: 'Invalid payload' }, 400);
    }

    // Enfileirar job
    try {
        const dataSource = getDataSource();
        const jobEnqueueService = new JobEnqueueService(dataSource);

        const jobId = await jobEnqueueService.enqueue({
            workflowType: WorkflowType.CODE_REVIEW,
            handlerType: HandlerType.PIPELINE_SYNC,
            payload: {
                platformType: PlatformType.GITHUB,
                repositoryId: repository.id?.toString(),
                repositoryName: repository.name,
                pullRequestNumber: pullRequest.number || body.number,
                pullRequestData: body,
                event,
            },
            organizationId: installation?.account?.id?.toString() || repository.owner?.id?.toString(),
            teamId: repository.owner?.id?.toString() || repository.id?.toString(),
        });

        console.log(`[GitHub] - Job enqueued: ${jobId} for PR #${pullRequest.number || body.number}`);

        return c.json({ jobId }, 202);
    } catch (error) {
        console.error('[GitHub] - Failed to enqueue job:', error);
        return c.json(
            { error: 'Failed to enqueue job', message: error instanceof Error ? error.message : 'Unknown error' },
            500,
        );
    }
});
```

---

## 📄 Exemplo 7: Route GitLab

```typescript
// src/webhook-handler-hono/routes/gitlab.ts
import { Hono } from 'hono';
import { validateGitLabSignature } from '../validators';
import { getDataSource } from '../database';
import { JobEnqueueService } from '../job-enqueue-service';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { WorkflowType } from '@/core/domain/workflowQueue/enums/workflow-type.enum';
import { HandlerType } from '@/core/domain/workflowQueue/enums/handler-type.enum';

export const gitlabWebhook = new Hono();

gitlabWebhook.post('/webhook', async (c) => {
    const token = c.req.header('x-gitlab-token');
    const event = c.req.header('x-gitlab-event');
    const body = await c.req.json();

    // Validar signature
    if (!validateGitLabSignature(token)) {
        return c.json({ error: 'Invalid token' }, 401);
    }

    // Filtrar eventos (merge request)
    if (event !== 'Merge Request Hook') {
        return c.json('Event ignored', 200);
    }

    const project = body.project;
    const mergeRequest = body.object_attributes;

    if (!project || !mergeRequest) {
        return c.json({ error: 'Invalid payload' }, 400);
    }

    // Enfileirar job
    try {
        const dataSource = getDataSource();
        const jobEnqueueService = new JobEnqueueService(dataSource);

        const jobId = await jobEnqueueService.enqueue({
            workflowType: WorkflowType.CODE_REVIEW,
            handlerType: HandlerType.PIPELINE_SYNC,
            payload: {
                platformType: PlatformType.GITLAB,
                repositoryId: project.id?.toString(),
                repositoryName: project.name,
                pullRequestNumber: mergeRequest.iid,
                pullRequestData: body,
                event,
            },
            organizationId: project.namespace_id?.toString(),
            teamId: project.id?.toString(),
        });

        console.log(`[GitLab] - Job enqueued: ${jobId} for MR !${mergeRequest.iid}`);

        return c.json({ jobId }, 202);
    } catch (error) {
        console.error('[GitLab] - Failed to enqueue job:', error);
        return c.json(
            { error: 'Failed to enqueue job', message: error instanceof Error ? error.message : 'Unknown error' },
            500,
        );
    }
});
```

---

## 📄 Exemplo 8: package.json (Dependências)

```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0",
    "amqplib": "^0.10.0",
    "typeorm": "^0.3.0",
    "pg": "^8.11.0",
    "uuid": "^9.0.0"
  }
}
```

**Instalar**:
```bash
yarn add hono @hono/node-server amqplib uuid
# typeorm e pg já devem estar instalados
```

---

## 📄 Exemplo 9: ecosystem.config.js (PM2)

```javascript
// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'webhook-handler',
            script: './dist/src/webhook-handler-hono.js',
            instances: 1,
            exec_mode: 'fork',
            env: {
                WEBHOOK_HANDLER_PORT: '3332',
                API_NODE_ENV: 'development',
                COMPONENT_TYPE: 'webhook',
                API_RABBITMQ_ENABLED: 'true',
                API_RABBITMQ_URI: 'amqp://localhost:5672/',
                API_DATABASE_URL: process.env.API_DATABASE_URL,
                GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
                GITLAB_WEBHOOK_SECRET: process.env.GITLAB_WEBHOOK_SECRET,
                BITBUCKET_WEBHOOK_SECRET: process.env.BITBUCKET_WEBHOOK_SECRET,
                AZURE_REPOS_WEBHOOK_SECRET: process.env.AZURE_REPOS_WEBHOOK_SECRET,
            },
            out_file: '/app/logs/webhook-handler/out.log',
            error_file: '/app/logs/webhook-handler/error.log',
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            kill_timeout: 5000,
        },
        // ... outros processos
    ],
};
```

---

## ✅ Resumo do Exemplo

### O Que Faz

1. **Recebe webhook** (GitHub, GitLab, Bitbucket, Azure Repos)
2. **Valida signature** (segurança)
3. **Salva job no banco** (WorkflowJob)
4. **Salva mensagem no outbox** (mesma transação)
5. **Publica na fila RabbitMQ** (amqplib direto)
6. **Responde 202** (aceito para processamento)

### Características

- ✅ **Leve**: ~20-30MB (vs ~150-200MB NestJS)
- ✅ **Rápido**: ~1-2s startup (vs ~10-15s NestJS)
- ✅ **Simples**: Código direto, sem complexidade desnecessária
- ✅ **Funcional**: Mesma funcionalidade do NestJS
- ✅ **Seguro**: Validação de signatures
- ✅ **Confiável**: Transactional Outbox pattern

---

## 🚀 Como Usar

1. **Instalar dependências**:
   ```bash
   yarn add hono @hono/node-server amqplib uuid
   ```

2. **Configurar variáveis de ambiente**:
   ```bash
   API_RABBITMQ_URI=amqp://localhost:5672/
   API_RABBITMQ_ENABLED=true
   API_DATABASE_URL=postgresql://...
   GITHUB_WEBHOOK_SECRET=seu_secret_aqui
   ```

3. **Build**:
   ```bash
   yarn build
   ```

4. **Rodar com PM2**:
   ```bash
   pm2 start ecosystem.config.js --only webhook-handler
   ```

---

## 💡 Próximos Passos

**Quer que eu implemente isso agora?**

Posso criar todos os arquivos:
1. ✅ Entry point (`webhook-handler-hono.ts`)
2. ✅ Cliente RabbitMQ (`rabbitmq-client.ts`)
3. ✅ Database (`database.ts`)
4. ✅ Serviço de enfileiramento (`job-enqueue-service.ts`)
5. ✅ Validadores (`validators.ts`)
6. ✅ Routes (GitHub, GitLab, Bitbucket, Azure Repos)
7. ✅ Atualizar `ecosystem.config.js`
8. ✅ Atualizar `package.json`

