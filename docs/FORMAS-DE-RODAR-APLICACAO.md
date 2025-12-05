# 🚀 Formas de Rodar a Aplicação

**Data**: 2025-01-27  
**Objetivo**: Documentar todas as formas disponíveis de rodar a aplicação

---

## 📊 Resumo Executivo

Existem **2 formas principais** de rodar a aplicação:

1. **Monolítica** - Tudo em um único container/processo
2. **Monorepo** - Aplicações separadas (webhook-handler, api-rest, worker)

---

## 🎯 Forma 1: Monolítica

### Opção A: `docker-compose.dev.small.yml` ⭐ **Recomendado para Dev**

**Arquitetura**: 1 container com tudo

```bash
yarn docker:up
```

**O que sobe**:
- ✅ `kodus-orchestrator` - Aplicação completa (API + Worker via código)
- ✅ `db_postgres` - PostgreSQL
- ✅ `db_mongodb` - MongoDB
- ❌ RabbitMQ - **Externo** (via `shared-network`)

**Características**:
- Dockerfile: `DockerFiles/Dockerfile.dev.small`
- Entrypoint: `dev-entrypoint.sh` → roda `yarn start:dev`
- Roda: `src/main.ts` (ApiModule completo)
- Worker: Integrado no mesmo processo (se habilitado)

**Quando usar**:
- ✅ Desenvolvimento local rápido
- ✅ Testes simples
- ✅ Setup mínimo

---

### Opção B: `docker-compose.dev.yml` (PM2)

**Arquitetura**: 1 container com PM2 gerenciando múltiplos processos

```bash
yarn docker:up:complete
```

**O que sobe**:
- ✅ `kodus-orchestrator` - Container com PM2 rodando:
  - `webhook-handler` (apps/webhooks)
  - `kodus-orchestrator` (apps/api)
  - `workflow-worker` (apps/worker)
- ⚠️ `db_postgres` - **Opcional** (profile: `local-db`)
- ⚠️ `db_mongodb` - **Opcional** (profile: `local-db`)
- ❌ RabbitMQ - **Externo** (via `shared-network`)

**Características**:
- Dockerfile: `DockerFiles/Dockerfile.dev`
- CMD: `yarn start:dev` (que inicia PM2 com `ecosystem.config.js`)
- PM2 gerencia 3 processos separados no mesmo container
- Bancos podem ser externos (usando `profiles: local-db`)

**Quando usar**:
- ✅ Quando precisa simular arquitetura de produção
- ✅ Quando bancos estão em ambiente remoto (QA/Prod)
- ✅ Quando precisa escalar processos separadamente

**Como rodar com bancos locais**:
```bash
docker compose --profile local-db -f docker-compose.dev.yml up
```

---

## 🎯 Forma 2: Monorepo (Aplicações Separadas)

### `docker-compose.dev.monorepo.yml`

**Arquitetura**: 3 containers separados + RabbitMQ

```bash
yarn docker:up:monorepo
```

**O que sobe**:
- ✅ `webhook-handler` - Porta 3332 (recebe webhooks)
- ✅ `api-rest` - Porta 3331 (API REST)
- ✅ `worker` - Processa jobs da fila
- ✅ `rabbitmq` - Message broker (para dev local)
- ✅ `db_postgres` - PostgreSQL
- ✅ `db_mongodb` - MongoDB

**Características**:
- Cada aplicação roda em container separado
- Dockerfiles específicos:
  - `Dockerfile.webhook-handler.dev`
  - `Dockerfile.api-rest.dev`
  - `Dockerfile.worker.dev`
- Escalabilidade independente
- RabbitMQ incluído (para dev local)

**Quando usar**:
- ✅ Desenvolvimento de features específicas de uma aplicação
- ✅ Testes de integração entre serviços
- ✅ Simular arquitetura de produção completa
- ✅ Debug de problemas específicos de um componente

**Rodar aplicações específicas**:
```bash
# Apenas webhook-handler
yarn docker:up:webhook-handler

# Apenas API REST
yarn docker:up:api-rest

# Apenas worker
yarn docker:up:worker
```

---

## 🔄 Forma 3: Sem Docker (Desenvolvimento Local)

### Opção A: Monolítico

```bash
# Requer: PostgreSQL, MongoDB e RabbitMQ rodando
yarn install
yarn migrate:dev
yarn start:dev
```

**Roda**: `src/main.ts` (ApiModule completo)

---

### Opção B: Aplicações Separadas

```bash
# Build das aplicações
yarn build:apps

# Rodar separadamente
yarn start:webhooks  # Porta 3332
yarn start:api      # Porta 3331
yarn start:worker   # Worker
```

---

## 📋 Comparação das Formas

| Aspecto | Monolítica (dev.small) | Monolítica (dev.yml) | Monorepo |
|---------|------------------------|----------------------|----------|
| **Containers** | 1 | 1 | 3+ |
| **Processos** | 1 | 3 (PM2) | 3 separados |
| **Bancos** | Incluídos | Opcionais | Incluídos |
| **RabbitMQ** | Externo | Externo | Incluído (dev) |
| **Escalabilidade** | Baixa | Média | Alta |
| **Complexidade** | Baixa | Média | Alta |
| **Uso** | Dev rápido | Dev/QA | Dev/Prod |

---

## 🎯 Recomendações

### Para Desenvolvimento Local

**Recomendado**: `docker-compose.dev.small.yml`

```bash
yarn docker:up
```

**Por quê**:
- ✅ Setup mais simples
- ✅ Tudo em um lugar
- ✅ Mais rápido para começar
- ✅ Menos recursos necessários

---

### Para Testes/QA

**Recomendado**: `docker-compose.dev.yml` (PM2)

```bash
# Com bancos locais
docker compose --profile local-db -f docker-compose.dev.yml up

# Com bancos remotos (QA/Prod)
ENV_FILE=.env.qa docker compose -f docker-compose.dev.yml up
```

**Por quê**:
- ✅ Simula arquitetura de produção
- ✅ Pode usar bancos remotos
- ✅ PM2 gerencia processos separados

---

### Para Desenvolvimento de Features Específicas

**Recomendado**: `docker-compose.dev.monorepo.yml`

```bash
# Tudo
yarn docker:up:monorepo

# Ou apenas o componente que está desenvolvendo
yarn docker:up:webhook-handler
yarn docker:up:api-rest
yarn docker:up:worker
```

**Por quê**:
- ✅ Isolamento por componente
- ✅ Debug mais fácil
- ✅ Escalabilidade independente

---

## 🔧 Configuração Necessária

### Para Todas as Formas

**RabbitMQ Externo** (exceto monorepo que tem próprio):
- Deve estar rodando em `shared-network`
- Hostname: `rabbitmq-local` (ou configurado)
- VHost: `kodus-ai`

**Variáveis de Ambiente**:
```env
# RabbitMQ
API_RABBITMQ_URL=amqp://dev:password@rabbitmq-local:5672/kodus-ai
API_RABBITMQ_VHOST=kodus-ai

# Bancos
API_PG_DB_HOST=localhost  # ou hostname do container
API_MONGODB_URI=mongodb://admin:admin@localhost:27017/kodus
```

---

## 📝 Resumo Final

**Existem 2 formas principais**:

1. **Monolítica** (1 container)
   - `dev.small` - Simples, tudo junto
   - `dev.yml` - PM2, processos separados

2. **Monorepo** (3+ containers)
   - `dev.monorepo` - Aplicações separadas

**Recomendação**: Use `dev.small` para desenvolvimento diário, `dev.monorepo` quando precisar testar componentes isolados.

---

**Última atualização**: 2025-01-27

