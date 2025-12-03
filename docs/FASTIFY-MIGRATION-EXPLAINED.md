# Migração para Fastify: O Que Significa?

## 🎯 Resposta Direta

**Migrar para Fastify** = Substituir NestJS por Fastify **apenas no webhook handler**.

**O que muda**:
- ❌ Não usa mais NestJS no webhook handler
- ✅ Usa Fastify (framework HTTP mais leve)
- ✅ Chama use cases diretamente (sem Dependency Injection do NestJS)

**O que NÃO muda**:
- ✅ Worker continua com NestJS
- ✅ API REST continua com NestJS
- ✅ Use cases continuam os mesmos
- ✅ Lógica de negócio continua igual

---

## 📊 Comparação Visual

### Atual: Webhook Handler com NestJS

```typescript
// src/webhook-handler.ts
import { NestFactory } from '@nestjs/core';
import { WebhookHandlerModule } from './modules/webhook-handler.module';

async function bootstrap() {
    const app = await NestFactory.create(WebhookHandlerModule);
    // ... configurações NestJS
    await app.listen(3332);
}

// src/modules/webhook-handler.module.ts
@Module({
    imports: [WebhookHandlerBaseModule], // Carrega MUITO
    controllers: [GithubController, ...],
})

// src/core/infrastructure/http/controllers/github.controller.ts
@Controller('github')
export class GithubController {
    constructor(
        private readonly receiveWebhookUseCase: ReceiveWebhookUseCase,
        // ... Dependency Injection do NestJS
    ) {}
    
    @Post('/webhook')
    handleWebhook(@Req() req, @Res() res) {
        // ...
    }
}
```

**Problema**: Carrega NestJS completo + WorkflowQueueModule completo

---

### Proposto: Webhook Handler com Fastify

```typescript
// src/webhook-handler-fastify.ts
import Fastify from 'fastify';
import { EnqueueCodeReviewJobUseCase } from '@/core/application/use-cases/workflowQueue/enqueue-code-review-job.use-case';

const fastify = Fastify({ logger: true });

// GitHub webhook
fastify.post('/github/webhook', async (request, reply) => {
    // Validar signature
    const signature = request.headers['x-hub-signature-256'];
    if (!validateSignature(signature, request.body)) {
        return reply.code(401).send({ error: 'Invalid signature' });
    }

    // Enfileirar job (chama use case diretamente)
    const useCase = new EnqueueCodeReviewJobUseCase(/* dependências */);
    const jobId = await useCase.execute({
        platformType: PlatformType.GITHUB,
        payload: request.body,
        event: request.headers['x-github-event'],
    });

    // Responder rápido
    return reply.code(202).send({ jobId });
});

fastify.listen({ port: 3332 }, (err) => {
    if (err) throw err;
    console.log('Webhook handler listening on port 3332');
});
```

**Vantagem**: Apenas Fastify (muito mais leve)

---

## 🔍 O Que É Fastify?

### Fastify = Framework HTTP Leve

**Comparação**:

| Framework | Memória | Startup | Performance |
|-----------|---------|---------|-------------|
| **NestJS** | ~150-200MB | ~10-15s | Boa |
| **Fastify** | ~20-30MB | ~1-2s | Excelente |
| **Express** | ~30-40MB | ~2-3s | Boa |

**Fastify é**:
- ✅ Framework HTTP minimalista (como Express, mas mais rápido)
- ✅ TypeScript nativo
- ✅ Plugins modulares
- ✅ Performance excelente
- ✅ Sintaxe simples

**Fastify NÃO é**:
- ❌ Um framework completo como NestJS
- ❌ Não tem Dependency Injection automático
- ❌ Não tem decorators complexos
- ❌ Não tem módulos/controllers automáticos

---

## 🔄 Como Funciona a Migração?

### Passo 1: Criar Novo Entry Point com Fastify

```typescript
// src/webhook-handler-fastify.ts
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

// Endpoints webhook
fastify.post('/github/webhook', async (request, reply) => {
    // Lógica aqui
});

fastify.post('/gitlab/webhook', async (request, reply) => {
    // Lógica aqui
});

fastify.listen({ port: 3332 });
```

### Passo 2: Instanciar Use Cases Manualmente

```typescript
// Sem Dependency Injection do NestJS
// Instanciamos manualmente:

import { EnqueueCodeReviewJobUseCase } from '@/core/application/use-cases/...';
import { RabbitMQJobQueueService } from '@/core/infrastructure/...';
import { WorkflowJobRepository } from '@/core/infrastructure/...';

// Criar dependências manualmente
const repository = new WorkflowJobRepository(/* ... */);
const queueService = new RabbitMQJobQueueService(/* ... */);
const useCase = new EnqueueCodeReviewJobUseCase(repository, queueService);
```

### Passo 3: Usar nos Endpoints

```typescript
fastify.post('/github/webhook', async (request, reply) => {
    const jobId = await useCase.execute({
        platformType: PlatformType.GITHUB,
        payload: request.body,
        event: request.headers['x-github-event'],
    });
    
    return reply.code(202).send({ jobId });
});
```

---

## 📋 O Que Precisa Fazer?

### 1. Criar `webhook-handler-fastify.ts`

```typescript
// src/webhook-handler-fastify.ts
import Fastify from 'fastify';
import { EnqueueCodeReviewJobUseCase } from '@/core/application/use-cases/workflowQueue/enqueue-code-review-job.use-case';
// ... outras dependências

const fastify = Fastify({ logger: true });

// Instanciar use cases manualmente
const enqueueUseCase = createEnqueueUseCase(); // Função helper

// GitHub webhook
fastify.post('/github/webhook', async (request, reply) => {
    // Validar signature
    // Enfileirar job
    // Responder 202
});

// ... outros endpoints

fastify.listen({ port: 3332 });
```

### 2. Criar Função Helper para Instanciar Use Cases

```typescript
// src/webhook-handler-fastify/dependencies.ts
export function createEnqueueUseCase(): EnqueueCodeReviewJobUseCase {
    // Criar todas as dependências manualmente
    const repository = new WorkflowJobRepository(/* ... */);
    const queueService = new RabbitMQJobQueueService(/* ... */);
    const outboxService = new TransactionalOutboxService(/* ... */);
    
    return new EnqueueCodeReviewJobUseCase(
        repository,
        queueService,
        outboxService,
    );
}
```

### 3. Atualizar `ecosystem.config.js`

```javascript
// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'webhook-handler',
            script: './dist/src/webhook-handler-fastify.js', // ← Mudou aqui
            // ...
        },
        // ...
    ],
};
```

### 4. Remover `webhook-handler.ts` (NestJS)

```bash
# Remover arquivo antigo
rm src/webhook-handler.ts
rm src/modules/webhook-handler.module.ts
rm src/modules/webhook-handler-base.module.ts
```

---

## 🎯 Estrutura Final

### Antes (NestJS)

```
src/
├── webhook-handler.ts              ← NestJS
├── modules/
│   ├── webhook-handler.module.ts   ← NestJS
│   └── webhook-handler-base.module.ts ← NestJS
└── core/
    └── infrastructure/
        └── http/
            └── controllers/
                └── github.controller.ts ← NestJS decorators
```

### Depois (Fastify)

```
src/
├── webhook-handler-fastify.ts      ← Fastify (novo)
├── webhook-handler-fastify/
│   └── dependencies.ts             ← Helper para criar use cases
└── core/
    └── application/
        └── use-cases/
            └── enqueue-code-review-job.use-case.ts ← Mesmo use case
```

---

## 💡 Exemplo Completo

### Webhook Handler com Fastify

```typescript
// src/webhook-handler-fastify.ts
import Fastify from 'fastify';
import { EnqueueCodeReviewJobUseCase } from '@/core/application/use-cases/workflowQueue/enqueue-code-review-job.use-case';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { createEnqueueUseCase } from './webhook-handler-fastify/dependencies';

const fastify = Fastify({ 
    logger: true,
    bodyLimit: 10485760, // 10MB
});

// Instanciar use case uma vez (singleton)
const enqueueUseCase = createEnqueueUseCase();

// GitHub webhook
fastify.post('/github/webhook', async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'] as string;
    const event = request.headers['x-github-event'] as string;
    const payload = request.body as any;

    // Validar signature
    if (!validateGitHubSignature(signature, payload)) {
        return reply.code(401).send({ error: 'Invalid signature' });
    }

    // Filtrar eventos não suportados
    if (event === 'pull_request') {
        const allowedActions = ['opened', 'synchronize', 'closed', 'reopened', 'ready_for_review'];
        if (!allowedActions.includes(payload?.action)) {
            return reply.code(200).send('Event ignored');
        }
    }

    // Enfileirar job
    try {
        const jobId = await enqueueUseCase.execute({
            platformType: PlatformType.GITHUB,
            payload,
            event,
        });

        // Log (opcional, assíncrono)
        logWebhook(PlatformType.GITHUB, event, payload);

        return reply.code(202).send({ jobId });
    } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to enqueue job' });
    }
});

// GitLab webhook
fastify.post('/gitlab/webhook', async (request, reply) => {
    // Similar ao GitHub
});

// Bitbucket webhook
fastify.post('/bitbucket/webhook', async (request, reply) => {
    // Similar ao GitHub
});

// Azure Repos webhook
fastify.post('/azure-repos/webhook', async (request, reply) => {
    // Similar ao GitHub
});

// Health check
fastify.get('/health', async (request, reply) => {
    return reply.code(200).send({ status: 'ok' });
});

// Iniciar servidor
fastify.listen({ port: 3332, host: '0.0.0.0' }, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    console.log('Webhook handler listening on port 3332');
});
```

### Helper para Criar Dependências

```typescript
// src/webhook-handler-fastify/dependencies.ts
import { EnqueueCodeReviewJobUseCase } from '@/core/application/use-cases/workflowQueue/enqueue-code-review-job.use-case';
import { WorkflowJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/workflow-job.repository';
import { RabbitMQJobQueueService } from '@/core/infrastructure/adapters/services/workflowQueue/rabbitmq-job-queue.service';
import { TransactionalOutboxService } from '@/core/infrastructure/adapters/services/workflowQueue/transactional-outbox.service';
// ... outras dependências

export function createEnqueueUseCase(): EnqueueCodeReviewJobUseCase {
    // Criar conexão com DB (TypeORM)
    const dataSource = createDataSource(); // Helper para criar DataSource
    
    // Criar repositório
    const repository = new WorkflowJobRepository(
        dataSource.getRepository(WorkflowJobModel),
    );
    
    // Criar RabbitMQ connection
    const rabbitMQConnection = createRabbitMQConnection(); // Helper
    
    // Criar serviços
    const queueService = new RabbitMQJobQueueService(rabbitMQConnection);
    const outboxService = new TransactionalOutboxService(
        dataSource.getRepository(OutboxMessageModel),
    );
    
    // Criar use case
    return new EnqueueCodeReviewJobUseCase(
        repository,
        queueService,
        outboxService,
    );
}
```

---

## ✅ Resumo: O Que Muda?

### O Que Muda ✅

1. **Entry point**: `webhook-handler.ts` → `webhook-handler-fastify.ts`
2. **Framework**: NestJS → Fastify
3. **Dependency Injection**: Automático (NestJS) → Manual (Fastify)
4. **Memória**: ~150-200MB → ~20-30MB
5. **Startup**: ~10-15s → ~1-2s

### O Que NÃO Muda ✅

1. **Use cases**: Continuam os mesmos
2. **Lógica de negócio**: Continua igual
3. **Repositórios**: Continuam os mesmos
4. **Serviços**: Continuam os mesmos
5. **Worker**: Continua com NestJS
6. **API REST**: Continua com NestJS

---

## 🎯 Conclusão

**Migrar para Fastify** = Substituir NestJS por Fastify **apenas no webhook handler**.

**É como**:
- Trocar o motor do carro (NestJS → Fastify)
- Mas manter o mesmo chassi (use cases, lógica, etc.)

**Benefícios**:
- ✅ 10x mais leve
- ✅ 5x mais rápido
- ✅ Performance excelente

**Desvantagens**:
- ⚠️ Precisa instanciar dependências manualmente
- ⚠️ Não tem Dependency Injection automático

**Vale a pena?** ✅ **SIM** para webhook handler (simples, stateless)

---

## 💡 Próximos Passos

**Quer que eu implemente o webhook handler com Fastify?**

Posso criar:
1. `webhook-handler-fastify.ts` (entry point)
2. `webhook-handler-fastify/dependencies.ts` (helper para criar use cases)
3. Atualizar `ecosystem.config.js`
4. Testar e validar

