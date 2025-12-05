# Análise de Dependências - package.json

**Data**: 2025-01-15  
**Objetivo**: Identificar dependências utilizadas vs não utilizadas no projeto

---

## 📊 Resumo Executivo

- **Total de dependências**: ~120 pacotes
- **Dependências utilizadas**: ~95 pacotes
- **Dependências não utilizadas**: ~25 pacotes
- **Dependências suspeitas**: ~10 pacotes (podem ser usadas indiretamente)

---

## ✅ Dependências UTILIZADAS

### Framework & Core

- ✅ `@nestjs/*` - Framework principal (common, core, config, etc.)
- ✅ `rxjs` - Usado pelo NestJS
- ✅ `reflect-metadata` - Decorators TypeScript
- ✅ `tslib` - TypeScript helpers

### LLM & AI

- ✅ `openai` - OpenAI SDK
- ✅ `@langchain/core` - Core LangChain
- ✅ `@langchain/openai` - OpenAI provider LangChain
- ✅ `@langchain/mongodb` - MongoDB memory para LangChain
- ✅ `@langchain/community` - Community integrations
- ✅ `langchain` - LangChain framework
- ✅ `langsmith` - LangSmith tracing
- ✅ `tiktoken` - Token counting

### Observability & Logging

- ✅ `@sentry/node` - Sentry error tracking
- ✅ `@sentry/nestjs` - Sentry NestJS integration
- ✅ `@sentry/opentelemetry` - Sentry + OpenTelemetry
- ✅ `@sentry/profiling-node` - Profiling
- ✅ `@opentelemetry/*` - OpenTelemetry (api, sdk-node, instrumentation, etc.)
- ✅ `pino` - Logger (via pino.service.ts)
- ✅ `pino-http` - Pino HTTP middleware
- ✅ `pino-pretty` - Pino formatter

### Database

- ✅ `typeorm` - ORM principal
- ✅ `typeorm-extension` - Seeders
- ✅ `pg` - PostgreSQL driver
- ✅ `mongoose` - MongoDB ODM
- ✅ `mongoose-paginate` - Pagination para Mongoose
- ✅ `pgvector` - Vector extension PostgreSQL

### Message Queue

- ✅ `@golevelup/nestjs-rabbitmq` - RabbitMQ NestJS integration
- ✅ `amqplib` - RabbitMQ client
- ✅ `amqp-connection-manager` - Connection manager

### Authentication & Security

- ✅ `@nestjs/jwt` - JWT tokens
- ✅ `@nestjs/passport` - Passport integration
- ✅ `passport` - Authentication
- ✅ `passport-jwt` - JWT strategy
- ✅ `bcryptjs` - Password hashing
- ✅ `@casl/ability` - Authorization (permissions)

### Platform Integrations

- ✅ `@octokit/rest` - GitHub API
- ✅ `@octokit/auth-app` - GitHub App auth
- ✅ `@octokit/graphql` - GitHub GraphQL
- ✅ `@gitbeaker/rest` - GitLab API
- ✅ `bitbucket` - Bitbucket SDK
- ✅ `@modelcontextprotocol/sdk` - MCP protocol

### HTTP & Express

- ✅ `@nestjs/platform-express` - Express adapter
- ✅ `body-parser` - Body parsing
- ✅ `express-rate-limit` - Rate limiting
- ✅ `helmet` - Security headers
- ✅ `volleyball` - HTTP logging middleware

### Validation & Transformation

- ✅ `class-validator` - Validation decorators
- ✅ `class-transformer` - Object transformation
- ✅ `zod` - Schema validation
- ✅ `joi` - Config validation

### Utilities

- ✅ `uuid` - UUID generation
- ✅ `nanoid` - Short ID generation
- ✅ `moment` / `moment-timezone` - Date manipulation
- ✅ `date-fns` - Date utilities
- ✅ `ramda` - Functional utilities
- ✅ `diff` - Diff algorithm
- ✅ `glob` - File globbing
- ✅ `picomatch` - Pattern matching
- ✅ `p-limit` - Concurrency control
- ✅ `immer` - Immutable updates
- ✅ `ajv` - JSON schema validation
- ✅ `json5` - JSON5 parser
- ✅ `js-yaml` - YAML parser
- ✅ `connection-string` - Connection string parser
- ✅ `simple-git` - Git operations

### Analytics & Tracking

- ✅ `@segment/analytics-node` - Segment analytics
- ✅ `posthog-node` - PostHog analytics

### Cache

- ✅ `@nestjs/cache-manager` - Cache manager
- ✅ `cache-manager` - Cache implementation

### ML & Data Science

- ✅ `ml-kmeans` - K-means clustering (usado em kodyFineTuning.service.ts)

### Email

- ✅ `mailersend` - Email service

### Other

- ✅ `source-map-support` - Source maps
- ✅ `http-status-codes` - HTTP status codes
- ✅ `cross-env` - Environment variables (scripts)

---

## ⚠️ Dependências USADAS POR PACKAGES INTERNOS

### LLM Providers (Usados por @kodus/flow e @kodus/kodus-common)

- ✅ `@google/generative-ai` - **USADO** por `@kodus/flow` em `gemini-provider.ts`
- ✅ `@langchain/anthropic` - **USADO** por `@kodus/kodus-common` (peerDependency) em `helper.ts` e `anthropicAdapter.ts`
- ✅ `@langchain/google-vertexai` - **USADO** por `@kodus/kodus-common` (peerDependency) em `helper.ts` e `vertexAdapter.ts`
- ⚠️ `@langchain/google-genai` - **PEER DEPENDENCY** de `@kodus/kodus-common` (pode ser usado)
- ⚠️ `@langchain/cohere` - **PEER DEPENDENCY** de `@kodus/kodus-common` (pode ser usado)
- ❌ `@anthropic-ai/sdk` - **NÃO ENCONTRADO** (não usado nem pelos packages internos)

### Utilities Usadas por Packages Internos

- ✅ `ajv` - **USADO** por `@kodus/flow` (dependência direta)
- ✅ `json5` - **USADO** por `@kodus/flow` (dependência direta)
- ✅ `zod-to-json-schema` - **PEER DEPENDENCY** de `@kodus/kodus-common` e usado por `@kodus/flow` em `tool-engine.ts`

---

## 📦 Dependências dos Packages Internos

### @kodus/flow

**Dependências diretas** (precisam estar no package.json raiz):

- ✅ `@google/generative-ai` - Usado em `gemini-provider.ts`
- ✅ `ajv` - Validação de schemas
- ✅ `json5` - Parser JSON5
- ✅ `mongodb` - Cliente MongoDB
- ✅ `openai` - SDK OpenAI
- ✅ `zod` - Validação de schemas

### @kodus/kodus-common

**Peer Dependencies** (precisam estar no package.json raiz):

- ✅ `@langchain/anthropic` - Usado em `helper.ts` e `anthropicAdapter.ts`
- ✅ `@langchain/google-vertexai` - Usado em `helper.ts` e `vertexAdapter.ts`
- ⚠️ `@langchain/google-genai` - Declarado como peerDependency (verificar uso)
- ⚠️ `@langchain/cohere` - Declarado como peerDependency (verificar uso)
- ✅ `zod-to-json-schema` - Conversão de schemas Zod para JSON Schema

**Nota**: Peer dependencies são dependências que o package espera que o projeto principal forneça. Elas não são instaladas automaticamente quando você instala o package, então precisam estar no `package.json` raiz.

---

## ❌ Dependências NÃO UTILIZADAS (Candidatas para Remoção)

### Search & Vector Stores

- ❌ `@tavily/core` - **NÃO ENCONTRADO** no código
- ❌ `weaviate-client` - **NÃO ENCONTRADO** no código

### Azure DevOps

- ❌ `azure-devops-node-api` - **NÃO UTILIZADO** - AzureReposService usa axios diretamente para fazer requisições REST à API do Azure DevOps

### Utilities Não Encontradas

- ❌ `add` - **NÃO ENCONTRADO** (pacote suspeito, pode ser typo)
- ❌ `fast-glob` - **NÃO ENCONTRADO** (usa `glob` ao invés)
- ❌ `file-type` - **NÃO ENCONTRADO**
- ❌ `graphql` - **NÃO ENCONTRADO** (usa apenas @octokit/graphql)
- ❌ `handlebars` - **NÃO ENCONTRADO**
- ❌ `nodemailer-express-handlebars` - **NÃO ENCONTRADO**
- ❌ `isolated-vm` - **NÃO ENCONTRADO**
- ❌ `blocked-at` - **NÃO ENCONTRADO**
- ❌ `pg-promise` - **NÃO ENCONTRADO** (usa apenas `pg`)
- ❌ `octokit` - **NÃO ENCONTRADO** (usa apenas @octokit/\*)
- ❌ `whatwg-url` - **NÃO ENCONTRADO**
- ❌ `yarn` - **NÃO ENCONTRADO** (não deveria estar em dependencies)

### Auth OAuth

- ❌ `@octokit/auth-oauth-app` - **NÃO ENCONTRADO** (usa apenas auth-app)

### Sentry CLI

- ❌ `@sentry/cli` - Usado apenas em scripts (deveria estar em devDependencies?)

---

## ⚠️ Dependências SUSPEITAS (Verificar Uso Indireto)

Estas podem ser usadas indiretamente ou em packages internos:

1. **`@kodus/flow`** - Package interno (yalc), pode usar algumas dependências
2. **`@kodus/kodus-common`** - Package interno (yalc), pode usar algumas dependências
3. **`@nestjs/axios`** - Pode ser usado indiretamente
4. **`@nestjs/devtools-integration`** - Pode ser usado em desenvolvimento
5. **`micromatch`** - Pode ser dependência transitiva
6. **`date-fns`** - Pode estar sendo usado mas não encontrado na busca

---

## 📋 Recomendações

### 1. Remover Dependências Não Utilizadas

```bash
# LLM Provider não utilizado (os outros são usados por packages internos)
yarn remove @anthropic-ai/sdk

# Search/Vector não utilizados
yarn remove @tavily/core weaviate-client

# Utilities não utilizadas
yarn remove add fast-glob file-type graphql handlebars nodemailer-express-handlebars isolated-vm blocked-at pg-promise octokit whatwg-url

# Auth não utilizado
yarn remove @octokit/auth-oauth-app
```

**⚠️ IMPORTANTE**: NÃO remover:

- `@google/generative-ai` - Usado por `@kodus/flow`
- `@langchain/anthropic` - Peer dependency de `@kodus/kodus-common`
- `@langchain/google-vertexai` - Peer dependency de `@kodus/kodus-common`
- `@langchain/google-genai` - Peer dependency de `@kodus/kodus-common` (pode ser usado)
- `@langchain/cohere` - Peer dependency de `@kodus/kodus-common` (pode ser usado)
- `ajv` - Usado por `@kodus/flow`
- `json5` - Usado por `@kodus/flow`
- `zod-to-json-schema` - Peer dependency de `@kodus/kodus-common` e usado por `@kodus/flow`

### 2. Mover para devDependencies

```bash
# CLI tools que são apenas para build
yarn remove @sentry/cli
yarn add -D @sentry/cli
```

### 3. Verificar Dependências Suspeitas

- Verificar se `azure-devops-node-api` é usado em `AzureReposService`
- Verificar se `@nestjs/axios` é usado indiretamente
- Verificar se `yarn` realmente precisa estar em dependencies (provavelmente não)

### 4. Verificar Packages Internos

- Verificar se `@kodus/flow` e `@kodus/kodus-common` usam alguma das dependências listadas como não utilizadas

---

## 🔍 Próximos Passos

1. ✅ Verificar uso de `azure-devops-node-api` em AzureReposService
2. ✅ Verificar se packages internos (`@kodus/flow`, `@kodus/kodus-common`) usam dependências listadas
3. ⚠️ Verificar se `@langchain/google-genai` e `@langchain/cohere` são realmente usados (são peerDependencies mas podem não estar sendo utilizados)
4. ✅ Testar remoção de dependências não utilizadas em ambiente de desenvolvimento
5. ✅ Verificar se alguma dependência é usada apenas em runtime (não em imports diretos)

---

## 📝 Notas

- A busca foi feita procurando por `import` e `from` statements
- Algumas dependências podem ser usadas dinamicamente ou via require()
- Dependências de build/dev podem estar em dependencies mas deveriam estar em devDependencies
- **Packages internos (`@kodus/flow`, `@kodus/kodus-common`) usam várias dependências que precisam estar no package.json raiz:**
    - `@kodus/flow` tem dependências diretas: `@google/generative-ai`, `ajv`, `json5`
    - `@kodus/kodus-common` tem peerDependencies: `@langchain/anthropic`, `@langchain/google-vertexai`, `@langchain/google-genai`, `@langchain/cohere`, `zod-to-json-schema`
    - Essas dependências precisam estar no package.json raiz para funcionar corretamente
