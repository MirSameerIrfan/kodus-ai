# Composição do Módulo Webhook Handler

## 📊 Resumo Executivo

**Objetivo**: Entender o que compõe o módulo webhook handler e o que é necessário para subir a aplicação.

---

## 🏗️ Estrutura do Módulo Webhook Handler

### Hierarquia de Módulos

```
WebhookHandlerModule (entry point)
    ↓ imports
WebhookHandlerBaseModule (base compartilhado)
    ↓ imports
[Vários módulos de infraestrutura e domínio]
```

---

## 📦 WebhookHandlerModule

**Arquivo**: `src/modules/webhook-handler.module.ts`

**O Que É**: Módulo de entrada que adiciona controllers HTTP ao `WebhookHandlerBaseModule`

**Contém**:

- ✅ Controllers HTTP:
    - `GithubController` (POST /github/webhook, GET /github/organization-name, GET /github/integration)
    - `GitlabController` (POST /gitlab/webhook)
    - `BitbucketController` (POST /bitbucket/webhook)
    - `AzureReposController` (POST /azure-repos/webhook)
    - `HealthController` (GET /health)

**NÃO Contém**:

- ❌ APP_GUARD (webhooks usam signature validation, não JWT)
- ❌ Providers (todos vêm do WebhookHandlerBaseModule)

**Entry Point**: `src/webhook-handler.ts` (porta 3332)

---

## 📦 WebhookHandlerBaseModule

**Arquivo**: `src/modules/webhook-handler-base.module.ts`

**O Que É**: Módulo base que contém toda a infraestrutura compartilhada

### Módulos Importados

#### 1. Core Infrastructure

- ✅ **ConfigModule.forRoot()**
    - Carrega variáveis de ambiente
    - Configurações da aplicação

- ✅ **EventEmitterModule.forRoot()**
    - Sistema de eventos interno
    - Comunicação assíncrona entre módulos

- ✅ **GlobalCacheModule**
    - Cache Redis/Memcached
    - Otimização de performance

- ✅ **RabbitMQWrapperModule.register()**
    - Conexão com RabbitMQ
    - Exchanges e queues configurados
    - AmqpConnection disponível

- ✅ **LogModule** (@Global)
    - PinoLoggerService
    - ObservabilityService
    - Sistema de logging estruturado

- ✅ **DatabaseModule**
    - Conexão PostgreSQL
    - TypeORM configurado
    - Pool de conexões (8 conexões para webhook handler)

- ✅ **SharedModule**
    - Utilitários compartilhados
    - Helpers e funções comuns

#### 2. Webhook-Specific

- ✅ **WebhookLogModule**
    - IWebhookLogService
    - Logging de webhooks recebidos
    - Auditoria

- ✅ **WebhookEnqueueModule** (NOVO - Módulo Mínimo)
    - `WorkflowJobRepository` (salvar jobs)
    - `OutboxMessageRepository` (salvar mensagens outbox)
    - `TransactionalOutboxService` (transactional outbox pattern)
    - `RabbitMQJobQueueService` (publicar no RabbitMQ)
    - `EnqueueCodeReviewJobUseCase` (enfileirar code review jobs)
    - `JOB_QUEUE_SERVICE_TOKEN` provider

#### 3. Platform Integration

- ✅ **PlatformIntegrationModule**
    - `ReceiveWebhookUseCase` (processar webhooks)
    - `GitHubPullRequestHandler` (handler GitHub)
    - `GitLabMergeRequestHandler` (handler GitLab)
    - `BitbucketPullRequestHandler` (handler Bitbucket)
    - `AzureReposPullRequestHandler` (handler Azure Repos)
    - `CodeManagementService`
    - `PlatformIntegrationFactory`
    - ⚠️ Importa `WorkflowQueueModule` completo (mas não é usado diretamente)

- ✅ **GithubModule**
    - `GetOrganizationNameUseCase`
    - `GetIntegrationGithubUseCase`
    - `GithubService`
    - Use cases GitHub

- ✅ **GitlabModule**
    - Handlers GitLab
    - Use cases GitLab

- ✅ **BitbucketModule**
    - `BitbucketService`
    - Handlers Bitbucket

- ✅ **AzureReposModule**
    - `AzureReposService`
    - Handlers Azure Repos

#### 4. Health

- ✅ **HealthModule**
    - `HealthController`
    - Health check endpoints

---

## 🔍 Dependências Indiretas (via PlatformIntegrationModule)

### PlatformIntegrationModule Importa

- `IntegrationModule`
- `IntegrationConfigModule`
- `AuthIntegrationModule`
- `GithubModule` (forwardRef)
- `GitlabModule` (forwardRef)
- `TeamMembersModule`
- `TeamsModule`
- `ProfileConfigModule`
- `AgentModule`
- `AutomationModule`
- `TeamAutomationModule`
- `ParametersModule`
- `OrganizationParametersModule`
- `CodeReviewFeedbackModule`
- `CodebaseModule`
- `KodyRulesModule`
- `AzureReposModule` (forwardRef)
- `BitbucketModule` (forwardRef)
- `IssuesModule`
- `CodeReviewSettingsLogModule`
- `PullRequestsModule`
- `McpAgentModule`
- `WorkflowQueueModule` (forwardRef) ⚠️ **Completo**

### WorkflowQueueModule Completo (via PlatformIntegrationModule)

**O Que Contém**:

- `WorkflowJobConsumer` (consome jobs) ❌ Não usado no webhook handler
- `CodeReviewJobProcessorService` (processa jobs) ❌ Não usado no webhook handler
- `ASTEventHandler` (espera eventos) ❌ Não usado no webhook handler
- `WorkflowResumedConsumer` (retoma workflows) ❌ Não usado no webhook handler
- `CodebaseModule` (acesso a repositórios) ❌ Não usado no webhook handler
- `PlatformIntegrationModule` (circular) ❌ Não usado no webhook handler

**Problema**: Carrega consumers e processors que não são usados no webhook handler

**Impacto**: Memória e startup maiores que o ideal

---

## 📋 O Que É Necessário para Subir a Aplicação

### 1. Dependências NPM/Yarn

**Instalar**:

```bash
yarn install
# ou
npm install
```

**Principais Dependências**:

- `@nestjs/core`, `@nestjs/common` (NestJS)
- `@nestjs/typeorm` (TypeORM)
- `@nestjs/config` (Configuração)
- `@golevelup/nestjs-rabbitmq` (RabbitMQ)
- `typeorm`, `pg` (PostgreSQL)
- `amqplib` (RabbitMQ client)
- `pino`, `pino-pretty` (Logging)
- E muitas outras...

---

### 2. Banco de Dados PostgreSQL

**Requisitos**:

- PostgreSQL rodando
- Schema `workflow` criado
- Tabelas criadas:
    - `workflow.workflow_jobs`
    - `workflow.job_execution_history`
    - `workflow.outbox_messages`
    - `workflow.inbox_messages`
    - `workflow.webhook_logs` (se existir)

**Variáveis de Ambiente**:

```bash
API_DATABASE_URL=postgresql://user:password@host:5432/database
# ou
API_DATABASE_HOST=localhost
API_DATABASE_PORT=5432
API_DATABASE_USERNAME=user
API_DATABASE_PASSWORD=password
API_DATABASE_DATABASE=database
```

**Pool de Conexões**:

- Webhook handler: 8 conexões (configurado via `COMPONENT_TYPE=webhook`)

---

### 3. RabbitMQ

**Requisitos**:

- RabbitMQ rodando (versão 4.1.4+)
- Exchanges criados:
    - `workflow.exchange` (tipo: topic, durable: true)
    - `workflow.exchange.dlx` (tipo: topic, durable: true)
    - `workflow.events` (tipo: topic, durable: true)
- Queues criadas:
    - `workflow.jobs.queue` (quorum queue)
    - `workflow.events.ast` (quorum queue)
    - `workflow.jobs.resumed.queue` (quorum queue)

**Variáveis de Ambiente**:

```bash
API_RABBITMQ_ENABLED=true
API_RABBITMQ_URI=amqp://user:password@host:5672/
```

**Nota**: Exchanges e queues são criados automaticamente pelo `RabbitMQWrapperModule` se não existirem

---

### 4. Variáveis de Ambiente

**Obrigatórias**:

```bash
# Database
API_DATABASE_URL=postgresql://...
# ou
API_DATABASE_HOST=localhost
API_DATABASE_PORT=5432
API_DATABASE_USERNAME=user
API_DATABASE_PASSWORD=password
API_DATABASE_DATABASE=database

# RabbitMQ
API_RABBITMQ_ENABLED=true
API_RABBITMQ_URI=amqp://localhost:5672/

# Component Type (para DB pool)
COMPONENT_TYPE=webhook

# Port
WEBHOOK_HANDLER_PORT=3332

# Environment
API_NODE_ENV=development
# ou
API_NODE_ENV=production
```

**Opcionais**:

```bash
# Webhook Secrets (para validação)
GITHUB_WEBHOOK_SECRET=seu_secret_aqui
GITLAB_WEBHOOK_SECRET=seu_secret_aqui
BITBUCKET_WEBHOOK_SECRET=seu_secret_aqui
AZURE_REPOS_WEBHOOK_SECRET=seu_secret_aqui

# Logging
LOG_LEVEL=info
API_LOG_PRETTY=true

# Workflow Queue Feature Flags
WORKFLOW_QUEUE_ENABLED=true
WORKFLOW_QUEUE_ENABLED_GITHUB=true
WORKFLOW_QUEUE_ENABLED_GITLAB=true
WORKFLOW_QUEUE_ENABLED_BITBUCKET=true
WORKFLOW_QUEUE_ENABLED_AZURE_REPOS=true
```

---

### 5. Build

**Compilar**:

```bash
yarn build
# ou
npm run build
```

**Resultado**:

- `dist/src/webhook-handler.js` (entry point)
- `dist/src/modules/...` (módulos compilados)
- `dist/src/core/...` (código core compilado)

---

### 6. PM2 (Process Manager)

**Configuração**: `ecosystem.config.js`

**Processos**:

1. `webhook-handler` (porta 3332)
2. `kodus-orchestrator` (porta 3331) - API REST
3. `workflow-worker` (sem HTTP) - Workers

**Iniciar**:

```bash
pm2 start ecosystem.config.js --env development
```

**Verificar**:

```bash
pm2 status
pm2 logs webhook-handler
```

---

## 🔍 Análise Detalhada: O Que Cada Módulo Carrega

### WebhookEnqueueModule (Mínimo)

**Providers**:

- `WorkflowJobRepository`
- `OutboxMessageRepository`
- `TransactionalOutboxService`
- `RabbitMQJobQueueService`
- `EnqueueCodeReviewJobUseCase`
- `JOB_QUEUE_SERVICE_TOKEN` provider

**Dependências**:

- `ConfigModule.forFeature(WorkflowQueueLoader)`
- `TypeOrmModule.forFeature([WorkflowJobModel, OutboxMessageModel])`
- `RabbitMQWrapperModule.register()`
- `LogModule` (@Global)

**Tamanho**: ~5-10MB

---

### PlatformIntegrationModule (Pesado)

**Providers**:

- `ReceiveWebhookUseCase`
- `GitHubPullRequestHandler`
- `GitLabMergeRequestHandler`
- `BitbucketPullRequestHandler`
- `AzureReposPullRequestHandler`
- `CodeManagementService`
- `PlatformIntegrationFactory`
- Muitos use cases

**Dependências**:

- `WorkflowQueueModule` completo ⚠️
- `CodebaseModule` ⚠️
- `AutomationModule` ⚠️
- `TeamAutomationModule` ⚠️
- `PullRequestsModule`
- `IssuesModule`
- `KodyRulesModule`
- E muitos outros...

**Tamanho**: ~50-80MB

---

### GithubModule (Médio)

**Providers**:

- `GetOrganizationNameUseCase`
- `GetIntegrationGithubUseCase`
- `GithubService`
- Muitos use cases GitHub

**Dependências**:

- `PlatformIntegrationModule` (forwardRef)
- `CodebaseModule`
- `AutomationModule`
- `TeamsModule`
- E outros...

**Tamanho**: ~10-20MB

---

## 📊 Tamanho Total Estimado

### Memória Total do Webhook Handler

**Componentes**:

- NestJS Core: ~20-30MB
- WebhookEnqueueModule: ~5-10MB
- PlatformIntegrationModule: ~50-80MB
- GithubModule: ~10-20MB
- GitlabModule: ~5-10MB
- BitbucketModule: ~5-10MB
- AzureReposModule: ~5-10MB
- DatabaseModule: ~10-15MB
- RabbitMQWrapperModule: ~5-10MB
- LogModule: ~5-10MB
- Outros módulos: ~10-20MB

**Total**: ~100-120MB (estimado)

**Startup**: ~5-7s (estimado)

---

## 🚀 Como Subir a Aplicação

### Passo 1: Preparar Ambiente

```bash
# 1. Instalar dependências
yarn install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# 3. Garantir que PostgreSQL está rodando
# 4. Garantir que RabbitMQ está rodando
```

### Passo 2: Preparar Banco de Dados

```bash
# Criar schema workflow (se não existir)
psql -U user -d database -c "CREATE SCHEMA IF NOT EXISTS workflow;"

# Rodar migrations (se existirem)
yarn migrate:dev
# ou
npm run migrate:dev
```

### Passo 3: Build

```bash
yarn build
```

### Passo 4: Iniciar com PM2

```bash
# Iniciar todos os processos
pm2 start ecosystem.config.js --env development

# Ou iniciar apenas webhook handler
pm2 start ecosystem.config.js --only webhook-handler --env development
```

### Passo 5: Verificar

```bash
# Verificar status
pm2 status

# Ver logs
pm2 logs webhook-handler

# Testar health check
curl http://localhost:3332/health
```

---

## 📋 Checklist: O Que Precisa para Subir

### Infraestrutura

- [ ] PostgreSQL rodando
- [ ] RabbitMQ rodando
- [ ] Schema `workflow` criado
- [ ] Tabelas criadas (ou migrations rodadas)

### Código

- [ ] Dependências instaladas (`yarn install`)
- [ ] Código compilado (`yarn build`)
- [ ] Variáveis de ambiente configuradas

### Processos

- [ ] PM2 instalado (`npm install -g pm2`)
- [ ] `ecosystem.config.js` configurado
- [ ] Processos iniciados (`pm2 start`)

### Validação

- [ ] Webhook handler responde na porta 3332
- [ ] Health check funciona (`GET /health`)
- [ ] Logs aparecem corretamente
- [ ] Sem erros de inicialização

---

## 🔍 Dependências Circulares

### ForwardRef Usado

**Por quê?**: Evitar dependências circulares

**Onde**:

- `PlatformIntegrationModule` ↔ `GithubModule` (forwardRef)
- `PlatformIntegrationModule` ↔ `WorkflowQueueModule` (forwardRef)
- `GithubModule` ↔ `PlatformIntegrationModule` (forwardRef)
- E outros...

**Impacto**: ⚠️ Pode causar problemas de inicialização se não configurado corretamente

---

## ✅ Resumo: O Que Compõe o Webhook Handler

### Módulos Diretos

1. **WebhookHandlerModule** (entry point)
    - Controllers HTTP

2. **WebhookHandlerBaseModule** (base)
    - Core Infrastructure (Config, EventEmitter, Cache, RabbitMQ, Log, Database, Shared)
    - WebhookEnqueueModule (mínimo)
    - PlatformIntegrationModule (pesado)
    - GithubModule, GitlabModule, BitbucketModule, AzureReposModule
    - WebhookLogModule, HealthModule

### Módulos Indiretos (via PlatformIntegrationModule)

- WorkflowQueueModule completo ⚠️
- CodebaseModule ⚠️
- AutomationModule ⚠️
- TeamAutomationModule ⚠️
- PullRequestsModule
- IssuesModule
- KodyRulesModule
- E muitos outros...

### Tamanho Total

- **Memória**: ~100-120MB
- **Startup**: ~5-7s
- **Dependências**: Muitas (via PlatformIntegrationModule)

---

## 🎯 O Que É Necessário para Subir

### Mínimo Necessário

1. ✅ PostgreSQL rodando
2. ✅ RabbitMQ rodando
3. ✅ Variáveis de ambiente configuradas
4. ✅ Dependências instaladas (`yarn install`)
5. ✅ Código compilado (`yarn build`)
6. ✅ PM2 instalado e configurado

### Opcional mas Recomendado

- ✅ Schema `workflow` criado
- ✅ Tabelas criadas (ou migrations rodadas)
- ✅ Webhook secrets configurados
- ✅ Feature flags configurados

---

## 💡 Próximos Passos

1. **Verificar se tudo está configurado**
2. **Testar compilação** (`yarn build`)
3. **Testar inicialização** (`pm2 start`)
4. **Validar funcionamento** (health check, webhook de teste)

---

**Quer que eu crie um script de setup ou um docker-compose para facilitar?**
