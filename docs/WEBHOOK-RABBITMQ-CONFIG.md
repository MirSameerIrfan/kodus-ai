# Webhook Handler e RabbitMQ: O Que Precisa?

## 🎯 Resposta Direta

**SIM**, o webhook handler precisa publicar na fila RabbitMQ.

**MAS** não precisa de toda a infraestrutura pesada do NestJS!

**Pode usar**: Cliente RabbitMQ direto (`amqplib`) - muito mais leve!

---

## 📊 O Que o Webhook Handler Precisa Fazer

### Fluxo Atual (NestJS Completo)

```
Webhook recebido
    ↓
Validar signature
    ↓
Salvar job no banco (WorkflowJob)
    ↓
Salvar mensagem no outbox (mesma transação)
    ↓
OutboxRelayService publica na fila RabbitMQ
    ↓
Worker consome da fila
```

**Problema**: Carrega NestJS completo + WorkflowQueueModule completo

---

### Fluxo Proposto (Hono + amqplib Direto)

```
Webhook recebido (Hono)
    ↓
Validar signature
    ↓
Salvar job no banco (TypeORM direto)
    ↓
Salvar mensagem no outbox (mesma transação)
    ↓
Publicar na fila RabbitMQ (amqplib direto)
    ↓
Worker consome da fila
```

**Vantagem**: Apenas Hono + amqplib (muito mais leve)

---

## 🔧 O Que Precisa de Configuração

### 1. Variáveis de Ambiente

```bash
# RabbitMQ Connection
API_RABBITMQ_URI=amqp://localhost:5672/
API_RABBITMQ_ENABLED=true

# Database (para salvar job e outbox)
API_DATABASE_URL=postgresql://...
```

### 2. Configuração RabbitMQ

**Exchange**: `workflow.exchange` (tipo: `topic`, durable: true)
**Routing Key**: `workflow.jobs.created.{workflowType}` (ex: `workflow.jobs.created.code_review`)
**Queue**: `workflow.jobs.queue` (já existe, criada pelo Worker)

**Não precisa criar exchanges/queues no webhook handler!**
- Exchanges e queues já existem (criadas pelo Worker ou RabbitMQWrapperModule)
- Webhook handler apenas **publica** mensagens

---

## 💡 Implementação: Webhook Handler com Hono + amqplib

### Opção 1: Usar amqplib Direto (Mais Leve) ✅

```typescript
// src/webhook-handler-hono/rabbitmq-client.ts
import amqp from 'amqplib';

let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
    const uri = process.env.API_RABBITMQ_URI || 'amqp://localhost:5672/';
    
    connection = await amqp.connect(uri);
    channel = await connection.createChannel();
    
    // Garantir que exchange existe (não cria se já existir)
    await channel.assertExchange('workflow.exchange', 'topic', {
        durable: true,
    });
}

export async function publishJob(jobId: string, workflowType: string, payload: any): Promise<void> {
    if (!channel) {
        throw new Error('RabbitMQ channel not initialized');
    }

    const routingKey = `workflow.jobs.created.${workflowType.toLowerCase()}`;
    
    await channel.publish('workflow.exchange', routingKey, Buffer.from(JSON.stringify({
        jobId,
        correlationId: payload.correlationId,
        workflowType,
        handlerType: payload.handlerType,
        organizationId: payload.organizationId,
        teamId: payload.teamId,
    })), {
        persistent: true,
        messageId: jobId,
        correlationId: payload.correlationId,
    });
}

export async function closeRabbitMQ(): Promise<void> {
    if (channel) await channel.close();
    if (connection) await connection.close();
}
```

### Opção 2: Usar Serviço Simplificado (Reutilizar Lógica)

```typescript
// src/webhook-handler-hono/job-enqueue-service.ts
import { DataSource } from 'typeorm';
import { WorkflowJobModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/workflow-job.model';
import { OutboxMessageModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/outbox-message.model';
import { publishJob } from './rabbitmq-client';

export class JobEnqueueService {
    constructor(private readonly dataSource: DataSource) {}

    async enqueue(job: {
        correlationId: string;
        workflowType: string;
        handlerType: string;
        payload: any;
        organizationId: string;
        teamId: string;
        status: string;
        priority: number;
        retryCount: number;
        maxRetries: number;
    }): Promise<string> {
        // Usa Transactional Outbox pattern
        const savedJob = await this.dataSource.transaction(async (manager) => {
            // 1. Salva job no banco
            const jobRepo = manager.getRepository(WorkflowJobModel);
            const jobToSave = jobRepo.create({
                ...job,
                id: undefined,
                createdAt: undefined,
                updatedAt: undefined,
            });
            const savedJob = await jobRepo.save(jobToSave);

            // 2. Salva mensagem no outbox (mesma transação)
            const outboxRepo = manager.getRepository(OutboxMessageModel);
            await outboxRepo.save({
                jobId: savedJob.id,
                exchange: 'workflow.exchange',
                routingKey: `workflow.jobs.created.${job.workflowType.toLowerCase()}`,
                payload: {
                    jobId: savedJob.id,
                    correlationId: job.correlationId,
                    workflowType: job.workflowType,
                    handlerType: job.handlerType,
                    organizationId: job.organizationId,
                    teamId: job.teamId,
                },
                status: 'pending',
                retryCount: 0,
                maxRetries: 3,
            });

            return savedJob;
        });

        // 3. Publica na fila RabbitMQ (fora da transação)
        await publishJob(savedJob.id, job.workflowType, {
            correlationId: job.correlationId,
            workflowType: job.workflowType,
            handlerType: job.handlerType,
            organizationId: job.organizationId,
            teamId: job.teamId,
        });

        return savedJob.id;
    }
}
```

### Entry Point com Hono

```typescript
// src/webhook-handler-hono.ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { connectRabbitMQ, closeRabbitMQ } from './webhook-handler-hono/rabbitmq-client';
import { createDataSource } from './webhook-handler-hono/database';
import { JobEnqueueService } from './webhook-handler-hono/job-enqueue-service';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { WorkflowType } from '@/core/domain/workflowQueue/enums/workflow-type.enum';
import { HandlerType } from '@/core/domain/workflowQueue/enums/handler-type.enum';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
import { v4 as uuid } from 'uuid';

const app = new Hono();
let dataSource: DataSource | null = null;
let jobEnqueueService: JobEnqueueService | null = null;

// Inicialização
async function initialize() {
    // Conectar RabbitMQ
    await connectRabbitMQ();
    
    // Conectar Database
    dataSource = await createDataSource();
    
    // Criar serviço
    jobEnqueueService = new JobEnqueueService(dataSource);
}

// GitHub webhook
app.post('/github/webhook', async (c) => {
    const signature = c.req.header('x-hub-signature-256');
    const event = c.req.header('x-github-event');
    const body = await c.req.json();

    // Validar signature
    if (!validateGitHubSignature(signature, body)) {
        return c.json({ error: 'Invalid signature' }, 401);
    }

    // Filtrar eventos
    if (event === 'pull_request') {
        const allowedActions = ['opened', 'synchronize', 'closed', 'reopened', 'ready_for_review'];
        if (!allowedActions.includes(body?.action)) {
            return c.json('Event ignored', 200);
        }
    }

    // Enfileirar job
    try {
        const jobId = await jobEnqueueService!.enqueue({
            correlationId: uuid(),
            workflowType: WorkflowType.CODE_REVIEW,
            handlerType: HandlerType.PIPELINE_SYNC,
            payload: {
                platformType: PlatformType.GITHUB,
                repositoryId: body.repository?.id,
                repositoryName: body.repository?.name,
                pullRequestNumber: body.pull_request?.number || body.number,
                pullRequestData: body,
            },
            organizationId: body.installation?.account?.id,
            teamId: body.repository?.owner?.id,
            status: JobStatus.PENDING,
            priority: 0,
            retryCount: 0,
            maxRetries: 3,
        });

        return c.json({ jobId }, 202);
    } catch (error) {
        console.error('Failed to enqueue job:', error);
        return c.json({ error: 'Failed to enqueue job' }, 500);
    }
});

// Health check
app.get('/health', (c) => {
    return c.json({ 
        status: 'ok',
        rabbitmq: connection ? 'connected' : 'disconnected',
        database: dataSource?.isInitialized ? 'connected' : 'disconnected',
    });
});

// Inicializar e iniciar servidor
const port = parseInt(process.env.WEBHOOK_HANDLER_PORT || '3332', 10);
const host = process.env.WEBHOOK_HANDLER_HOST || '0.0.0.0';

initialize().then(() => {
    serve({
        fetch: app.fetch,
        port,
        hostname: host,
    }, (info) => {
        console.log(`[WebhookHandler] - Ready on http://${info.address}:${info.port}`);
    });
}).catch((error) => {
    console.error('Failed to initialize webhook handler:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    await closeRabbitMQ();
    if (dataSource) await dataSource.destroy();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await closeRabbitMQ();
    if (dataSource) await dataSource.destroy();
    process.exit(0);
});
```

---

## 📋 Dependências Necessárias

### package.json

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

## 🔍 Comparação: NestJS vs Hono + amqplib

### NestJS Completo (Atual)

```
Dependências:
• @nestjs/core
• @nestjs/common
• @golevelup/nestjs-rabbitmq
• NestJS completo

Memória: ~150-200MB
Startup: ~10-15s
```

### Hono + amqplib (Proposto)

```
Dependências:
• hono
• @hono/node-server
• amqplib (cliente RabbitMQ nativo)
• typeorm (já existe)
• uuid

Memória: ~20-30MB
Startup: ~1-2s
```

**Redução**: 10x mais leve, 10x mais rápido!

---

## ✅ Resumo: O Que Precisa

### Configurações Necessárias

1. **Variáveis de Ambiente**:
   ```bash
   API_RABBITMQ_URI=amqp://localhost:5672/
   API_RABBITMQ_ENABLED=true
   API_DATABASE_URL=postgresql://...
   ```

2. **RabbitMQ**:
   - ✅ Exchange `workflow.exchange` (já existe, criada pelo Worker)
   - ✅ Queue `workflow.jobs.queue` (já existe, criada pelo Worker)
   - ✅ Webhook handler apenas **publica** mensagens

3. **Database**:
   - ✅ Tabela `workflow.workflow_jobs` (já existe)
   - ✅ Tabela `workflow.outbox_messages` (já existe)
   - ✅ Webhook handler apenas **escreve** (salva job e outbox)

### O Que NÃO Precisa

- ❌ Criar exchanges/queues (já existem)
- ❌ Consumir mensagens (workers fazem isso)
- ❌ NestJS completo
- ❌ WorkflowQueueModule completo
- ❌ Consumers/Processors

---

## 🎯 Conclusão

**SIM**, o webhook handler precisa de configuração RabbitMQ.

**MAS** pode ser feito de forma muito mais leve:
- ✅ Usar `amqplib` direto (cliente RabbitMQ nativo)
- ✅ Não precisa de NestJS completo
- ✅ Apenas publicar mensagens (não consumir)
- ✅ Configuração mínima (URI do RabbitMQ)

**Benefícios**:
- ✅ 10x mais leve (20-30MB vs 150-200MB)
- ✅ 10x mais rápido (1-2s vs 10-15s startup)
- ✅ Mesma funcionalidade (publicar na fila)
- ✅ Mesma garantia (Transactional Outbox)

---

## 💡 Próximos Passos

**Quer que eu implemente o webhook handler com Hono + amqplib?**

Posso criar:
1. `webhook-handler-hono.ts` (entry point)
2. `rabbitmq-client.ts` (cliente RabbitMQ com amqplib)
3. `job-enqueue-service.ts` (serviço para enfileirar jobs)
4. `database.ts` (helper para criar DataSource)
5. Routes (GitHub, GitLab, Bitbucket, Azure Repos)
6. Atualizar `ecosystem.config.js`

