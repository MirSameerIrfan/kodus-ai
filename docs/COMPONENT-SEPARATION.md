# Separação de Componentes - Arquitetura Atual

## 📁 Estrutura Física

```
kodus-ai/
├── src/
│   ├── main.ts                    ← Entry point API REST (porta 3331)
│   ├── webhook-handler.ts         ← Entry point Webhook Handler (porta 3332)
│   ├── worker.ts                  ← Entry point Worker (sem HTTP)
│   │
│   └── modules/
│       ├── app.module.ts          ← Módulo base compartilhado (infraestrutura comum)
│       ├── api.module.ts          ← Módulo API REST (herda AppModule + controllers HTTP)
│       ├── webhook-handler.module.ts ← Módulo Webhook Handler (herda WebhookHandlerBaseModule)
│       ├── webhook-handler-base.module.ts ← Base leve para webhook handler
│       └── worker.module.ts       ← Módulo Worker (herda AppModule + consumers)
│
└── ecosystem.config.js            ← Configuração PM2 (3 processos separados)
```

---

## 🔄 Fluxo de Separação

### 1. Entry Points (Processos Separados)

```typescript
// src/main.ts
import { ApiModule } from './modules/api.module';
const app = await NestFactory.create(ApiModule);
await app.listen(3331); // API REST

// src/webhook-handler.ts
import { WebhookHandlerModule } from './modules/webhook-handler.module';
const app = await NestFactory.create(WebhookHandlerModule);
await app.listen(3332); // Webhook Handler

// src/worker.ts
import { WorkerModule } from './modules/worker.module';
const app = await NestFactory.createApplicationContext(WorkerModule);
// Sem HTTP - apenas processamento
```

### 2. Módulos (Herança)

```
AppModule (base compartilhado)
├── DatabaseModule
├── RabbitMQWrapperModule
├── LogModule
├── Todos os módulos de domínio
└── Todos os módulos de negócio

    ↓ herda

ApiModule
├── AppModule (tudo acima)
└── Controllers HTTP
    ├── AuthController
    ├── WorkflowQueueController
    ├── ParametersController
    └── ... (todos os controllers)

    ↓ herda

WebhookHandlerBaseModule (leve)
├── DatabaseModule (apenas para logs)
├── RabbitMQWrapperModule (para enfileirar)
├── LogModule
├── WebhookLogModule
└── WorkflowQueueModule (apenas para enfileirar)

    ↓ herda

WebhookHandlerModule
├── WebhookHandlerBaseModule
└── Controllers Webhook
    ├── GithubController
    ├── GitlabController
    ├── BitbucketController
    └── AzureReposController

    ↓ herda

WorkerModule
├── AppModule (tudo)
└── WorkflowQueueModule (consumers, processors)
```

---

## 🚀 Processos PM2

### ecosystem.config.js

```javascript
{
  apps: [
    {
      name: 'webhook-handler',      // Processo 1
      script: './dist/src/webhook-handler.js',
      port: 3332,
      exec_mode: 'fork'             // Stateless, pode escalar
    },
    {
      name: 'kodus-orchestrator',   // Processo 2
      script: './dist/src/main.js',
      port: 3331,
      exec_mode: 'fork'             // API REST
    },
    {
      name: 'workflow-worker',      // Processo 3
      script: './dist/src/worker.js',
      exec_mode: 'cluster',         // Pode escalar (múltiplas instâncias)
      instances: 1                  // Aumentar conforme necessário
    }
  ]
}
```

### Comandos PM2

```bash
# Iniciar todos os processos
pm2 start ecosystem.config.js

# Ver status
pm2 status

# Ver logs
pm2 logs webhook-handler
pm2 logs kodus-orchestrator
pm2 logs workflow-worker

# Reiniciar apenas um processo
pm2 restart webhook-handler

# Escalar workers
pm2 scale workflow-worker 3  # 3 instâncias de workers
```

---

## 🔌 Portas e Comunicação

```
┌─────────────────────────────────────────────────────────┐
│ WEBHOOK HANDLER (Porta 3332)                            │
│                                                          │
│ Recebe:                                                  │
│   POST /github/webhook                                  │
│   POST /gitlab/webhook                                  │
│   POST /bitbucket/webhook                               │
│   POST /azure-repos/webhook                             │
│                                                          │
│ Comunica com:                                            │
│   → RabbitMQ (enfileira jobs)                           │
│   → PostgreSQL (logs de webhook)                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ RABBITMQ (Fila)                                         │
│                                                          │
│ Exchanges:                                              │
│   - workflow.exchange (jobs)                            │
│   - workflow.events (eventos externos)                  │
│                                                          │
│ Queues:                                                 │
│   - workflow.jobs.queue (jobs para processar)           │
│   - workflow.events.ast (eventos AST)                   │
│   - workflow.jobs.resumed (jobs resumidos)              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ WORKER (Sem HTTP)                                       │
│                                                          │
│ Consome:                                                 │
│   - workflow.jobs.queue                                 │
│   - workflow.events.ast                                 │
│   - workflow.jobs.resumed                               │
│                                                          │
│ Comunica com:                                            │
│   → PostgreSQL (atualiza jobs)                         │
│   → RabbitMQ (publica eventos)                          │
│   → LLM APIs (análise de código)                       │
│   → GitHub/GitLab/etc (publica comentários)            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ API REST (Porta 3331)                                   │
│                                                          │
│ Expõe:                                                   │
│   GET /workflow-queue/jobs/{jobId}                     │
│   GET /workflow-queue/metrics                           │
│   GET /auth/login                                        │
│   GET /parameters/*                                      │
│   GET /code-management/*                                │
│   ... (todos os endpoints da aplicação)                │
│                                                          │
│ Comunica com:                                            │
│   → PostgreSQL (consulta jobs, usuários, etc.)        │
│   → MongoDB (logs, etc.)                                │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Comparação dos Componentes

| Aspecto | Webhook Handler | API REST | Worker |
|---------|----------------|----------|--------|
| **Entry Point** | `webhook-handler.ts` | `main.ts` | `worker.ts` |
| **Módulo** | `WebhookHandlerModule` | `ApiModule` | `WorkerModule` |
| **Base Module** | `WebhookHandlerBaseModule` | `AppModule` | `AppModule` |
| **Porta** | 3332 | 3331 | N/A (sem HTTP) |
| **Processo PM2** | `webhook-handler` | `kodus-orchestrator` | `workflow-worker` |
| **Exec Mode** | `fork` | `fork` | `cluster` |
| **Instâncias** | 1 (pode escalar) | 1 | 1+ (pode escalar) |
| **Autenticação** | Signature validation | JWT | N/A |
| **Controllers** | Apenas webhooks | Todos HTTP | Nenhum |
| **Consumers** | Nenhum | Nenhum | RabbitMQ consumers |
| **Memória** | ~100-150MB | ~500MB | ~500MB |
| **Startup** | ~5-10s | ~15-30s | ~15-30s |

---

## 🔐 Autenticação e Segurança

### Webhook Handler
- **Autenticação**: Signature validation (GitHub secret, GitLab token, etc.)
- **Sem JWT**: Webhooks não precisam de autenticação de usuário
- **Rate Limiting**: 1000 req/min (mais permissivo, webhooks são bursty)

### API REST
- **Autenticação**: JWT (usuários autenticados)
- **APP_GUARD**: `JwtAuthGuard` aplicado globalmente
- **Rate Limiting**: Configurável por endpoint (mais restritivo)
- **Permissions**: Policy-based (CASL)

### Worker
- **Sem HTTP**: Não expõe endpoints
- **Autenticação**: N/A (processa jobs internamente)
- **Segurança**: Acesso apenas via RabbitMQ (rede interna)

---

## 📦 Dependências Compartilhadas

### AppModule (Base Compartilhado)
- ✅ DatabaseModule (PostgreSQL + MongoDB)
- ✅ RabbitMQWrapperModule
- ✅ LogModule
- ✅ Todos os módulos de domínio
- ✅ Todos os módulos de negócio
- ❌ Controllers HTTP (adicionados por módulos específicos)
- ❌ APP_GUARD (adicionado por ApiModule)

### WebhookHandlerBaseModule (Leve)
- ✅ DatabaseModule (apenas para logs)
- ✅ RabbitMQWrapperModule (apenas para enfileirar)
- ✅ LogModule
- ✅ WebhookLogModule
- ✅ WorkflowQueueModule (apenas enfileiramento)
- ❌ LLM modules
- ❌ AST modules
- ❌ Code review execution
- ❌ Autenticação JWT

### WorkerModule
- ✅ AppModule completo (precisa de tudo)
- ✅ WorkflowQueueModule (consumers, processors)
- ✅ Todos os módulos de processamento

---

## 🎯 Responsabilidades por Componente

### Webhook Handler
1. ✅ Receber webhooks de plataformas
2. ✅ Validar signature
3. ✅ Enfileirar jobs no RabbitMQ
4. ✅ Responder 202 Accepted rapidamente
5. ✅ Logar webhooks recebidos
6. ❌ Processar code reviews (workers fazem isso)
7. ❌ Autenticação JWT (não precisa)

### API REST
1. ✅ Autenticação JWT
2. ✅ Dashboard/Admin interface
3. ✅ Consultar status de jobs
4. ✅ Métricas e monitoramento
5. ✅ Gerenciar configurações
6. ✅ Gerenciar integrações
7. ✅ Todos os endpoints da aplicação
8. ❌ Processar code reviews (workers fazem isso)

### Worker
1. ✅ Consumir jobs da fila RabbitMQ
2. ✅ Processar code reviews completos
3. ✅ Chamar LLM para análise
4. ✅ Executar AST analysis
5. ✅ Publicar comentários no GitHub/GitLab
6. ✅ Atualizar status dos jobs
7. ✅ Gerenciar retries e erros
8. ❌ Expor endpoints HTTP (não precisa)

---

## 🔄 Comunicação Entre Componentes

### Webhook Handler → Worker
```
Webhook Handler recebe webhook
  ↓
Enfileira job no RabbitMQ (workflow.jobs.queue)
  ↓
Worker consome job da fila
  ↓
Worker processa code review
```

### API REST → Worker
```
API REST consulta status
  ↓
Lê do PostgreSQL (workflow_jobs table)
  ↓
Retorna status atual do job
```

### Worker → API REST
```
Worker processa job
  ↓
Atualiza status no PostgreSQL
  ↓
API REST pode consultar status atualizado
```

---

## 🚦 Escalabilidade

### Webhook Handler
- **Escala horizontal**: Múltiplas instâncias (stateless)
- **Load balancer**: Distribui webhooks entre instâncias
- **Independente**: Pode escalar sem afetar workers

### API REST
- **Escala horizontal**: Múltiplas instâncias (stateless)
- **Load balancer**: Distribui requisições entre instâncias
- **Independente**: Pode escalar sem afetar workers

### Worker
- **Escala horizontal**: Múltiplas instâncias (cluster mode)
- **RabbitMQ**: Distribui jobs entre workers automaticamente
- **Independente**: Pode escalar sem afetar webhook handler ou API

---

## 📝 Resumo da Separação

### ✅ O que está separado:
1. **Entry points**: 3 arquivos diferentes (`main.ts`, `webhook-handler.ts`, `worker.ts`)
2. **Módulos**: 3 módulos diferentes (`ApiModule`, `WebhookHandlerModule`, `WorkerModule`)
3. **Processos PM2**: 3 processos separados
4. **Portas**: Portas diferentes (3331, 3332, sem HTTP)
5. **Autenticação**: Diferentes estratégias (JWT vs Signature)
6. **Escalabilidade**: Escalam independentemente

### ⚠️ O que é compartilhado:
1. **Código**: Mesmo repositório (monorepo)
2. **Infraestrutura**: Database, RabbitMQ, Logging (via AppModule)
3. **Lógica de negócio**: Use cases, services, repositories

### 🎯 Benefícios:
1. ✅ Deploy independente (pode reiniciar um sem afetar outros)
2. ✅ Escalabilidade independente (escala conforme necessidade)
3. ✅ Isolamento de recursos (CPU, memória por processo)
4. ✅ Facilita debugging (logs separados)
5. ✅ Facilita monitoramento (métricas por componente)

---

## 🔍 Verificação da Separação

### Como verificar se está separado:

```bash
# 1. Ver processos PM2 rodando
pm2 status
# Deve mostrar 3 processos: webhook-handler, kodus-orchestrator, workflow-worker

# 2. Ver portas em uso
netstat -tulpn | grep -E '3331|3332'
# Deve mostrar:
#   - 3331: kodus-orchestrator (API REST)
#   - 3332: webhook-handler

# 3. Ver logs separados
pm2 logs webhook-handler    # Logs do webhook handler
pm2 logs kodus-orchestrator # Logs da API REST
pm2 logs workflow-worker    # Logs do worker

# 4. Testar endpoints
curl http://localhost:3331/health  # API REST
curl http://localhost:3332/health  # Webhook Handler
# Worker não tem HTTP - testar via RabbitMQ
```

---

## 📚 Próximos Passos

1. ✅ Separação física completa (feito)
2. ⏳ Otimizar webhook handler (migrar para Fastify?)
3. ⏳ Testar escalabilidade independente
4. ⏳ Monitorar métricas por componente
5. ⏳ Documentar deployment separado

