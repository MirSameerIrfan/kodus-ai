# Apps - Microserviços

Esta pasta contém os microserviços da aplicação Kodus AI.

## Estrutura

```
apps/
  ├── webhooks/          # Recebe webhooks e enfileira jobs
  ├── api/               # API REST - Endpoints administrativos
  └── worker/            # Worker - Processa jobs/filas
```

## Webhook Handler

**Porta**: 3332

**Responsabilidades**:

- Receber webhooks (GitHub, GitLab, Bitbucket, Azure Repos)
- Validar signature
- Enfileirar payload bruto na fila RabbitMQ
- Retornar 200 OK imediatamente

**Não faz**:

- Processar webhooks (workers fazem isso)
- Validar organização/team (workers fazem isso)
- Executar code review (workers fazem isso)

## API REST

**Porta**: 3331

**Responsabilidades**:

- Endpoints administrativos (GET /workflow-queue/jobs, etc.)
- Endpoints de integração (GET /github/organization-name, etc.)
- Autenticação/autorização (JWT)

**Não faz**:

- Receber webhooks (webhook handler faz isso)
- Processar jobs (worker faz isso)

## Worker

**Porta**: Nenhuma (sem HTTP)

**Responsabilidades**:

- Consumir mensagens da fila RabbitMQ
- Processar webhooks
- Executar code review
- Executar lógica de negócio

## Build e Deploy

Cada app pode ser buildado e deployado independentemente:

```bash
# Build webhooks
yarn build:webhooks

# Build API
yarn build:api

# Build worker
yarn build:worker
```
Em ambiente cloud (ECS), cada app roda como **1 processo por container**.
