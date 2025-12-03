# Docker e Monorepo: Como Rodar Apps Separadamente

## 🎯 Objetivo

Rodar apenas o webhook handler (ou qualquer app) de forma independente usando Docker.

---

## 📋 Estrutura Criada

### Dockerfiles Separados

- ✅ `DockerFiles/Dockerfile.webhook-handler.dev`
- ✅ `DockerFiles/Dockerfile.api-rest.dev`
- ✅ `DockerFiles/Dockerfile.worker.dev`

### Docker Compose Monorepo

- ✅ `docker-compose.dev.monorepo.yml` (serviços separados)

### Scripts no Package.json

- ✅ `build:webhook-handler`, `build:api-rest`, `build:worker`
- ✅ `start:webhook-handler`, `start:api-rest`, `start:worker`
- ✅ `docker:build:webhook-handler`, `docker:build:api-rest`, `docker:build:worker`
- ✅ `docker:start:webhook-handler`, `docker:start:api-rest`, `docker:start:worker`

---

## 🚀 Como Rodar Apenas o Webhook Handler

### Opção 1: Docker Compose (Recomendado)

```bash
# Rodar apenas webhook handler + dependências (DB, RabbitMQ)
yarn docker:start:webhook-handler

# Ou manualmente
docker compose -f docker-compose.dev.monorepo.yml up webhook-handler db_postgres db_mongodb rabbitmq
```

**O que vai subir**:

- ✅ `webhook-handler` (porta 3332)
- ✅ `db_postgres` (porta 5432)
- ✅ `db_mongodb` (porta 27017)
- ✅ `rabbitmq` (porta 5672, 15672)

**O que NÃO vai subir**:

- ❌ `api-rest`
- ❌ `worker`

---

### Opção 2: Build Local + Node

```bash
# Build apenas webhook handler
yarn build:webhook-handler

# Rodar localmente (precisa de DB e RabbitMQ rodando)
yarn start:webhook-handler
```

---

### Opção 3: Docker Build + Run Individual

```bash
# Build apenas webhook handler
yarn docker:build:webhook-handler

# Rodar container
docker run -p 3332:3332 \
  --env-file .env \
  --network kodus-backend-services \
  kodus-webhook-handler-dev
```

---

## 📊 Comparação: Antes vs Depois

### Antes (Estrutura Antiga)

**Para rodar apenas webhook handler**:

- ❌ Não era possível
- ❌ Tinha que rodar tudo junto
- ❌ PM2 gerenciava tudo no mesmo container

**Comando**:

```bash
docker compose up kodus-orchestrator  # Rodava tudo
```

---

### Depois (Estrutura Monorepo)

**Para rodar apenas webhook handler**:

- ✅ É possível!
- ✅ Serviço separado no docker-compose
- ✅ Container independente

**Comando**:

```bash
yarn docker:start:webhook-handler  # Apenas webhook handler
```

---

## 🎯 Resposta: É Possível Rodar Apenas o Webhook Handler?

**SIM!** ✅

**Como**:

```bash
yarn docker:start:webhook-handler
```

**O que vai subir**:

- Webhook handler (porta 3332)
- PostgreSQL (porta 5432)
- MongoDB (porta 27017)
- RabbitMQ (porta 5672, 15672)

**O que NÃO vai subir**:

- API REST
- Worker

---

## 📋 Scripts Disponíveis

### Build

```bash
# Build individual
yarn build:webhook-handler
yarn build:api-rest
yarn build:worker

# Build todos
yarn build:apps
```

### Start Local

```bash
# Start individual (precisa de DB e RabbitMQ rodando)
yarn start:webhook-handler
yarn start:api-rest
yarn start:worker
```

### Docker Build

```bash
# Build individual
yarn docker:build:webhook-handler
yarn docker:build:api-rest
yarn docker:build:worker

# Build todos
yarn docker:build:monorepo
```

### Docker Start

```bash
# Start individual (com dependências)
yarn docker:start:webhook-handler
yarn docker:start:api-rest
yarn docker:start:worker

# Start todos
yarn docker:start:monorepo
```

---

## ⚠️ Notas Importantes

### 1. Dependências Compartilhadas

Os apps compartilham:

- ✅ Banco de dados (PostgreSQL, MongoDB)
- ✅ RabbitMQ
- ✅ Código em `src/` (compartilhado)

### 2. Portas

- **Webhook Handler**: 3332
- **API REST**: 3331
- **Worker**: Nenhuma (sem HTTP)

### 3. Variáveis de Ambiente

Cada app precisa de:

- `COMPONENT_TYPE` (webhook, api, worker)
- `WEBHOOK_HANDLER_PORT` (apenas webhook-handler)
- `API_PORT` (apenas api-rest)
- `WORKFLOW_QUEUE_WORKER_ENABLED` (apenas worker)

---

## 🚀 Próximos Passos

1. **Testar build de cada app**:

    ```bash
    yarn build:webhook-handler
    yarn build:api-rest
    yarn build:worker
    ```

2. **Testar Docker Compose**:

    ```bash
    yarn docker:start:webhook-handler
    ```

3. **Verificar logs**:

    ```bash
    docker logs -f kodus-webhook-handler-dev
    ```

4. **Testar health check**:
    ```bash
    curl http://localhost:3332/health
    ```

---

**Quer que eu teste o build agora?**
