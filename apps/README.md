# Apps - Microserviços

Esta pasta contém os microserviços da aplicação Kodus AI.

## Estrutura

```
apps/
  ├── webhook-handler/    # Recebe webhooks e enfileira na fila
  ├── api-rest/          # API REST - Endpoints administrativos
  └── worker/            # Worker - Processa jobs da fila
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
# Build webhook handler
cd apps/webhook-handler
yarn build

# Build API REST
cd apps/api-rest
yarn build

# Build worker
cd apps/worker
yarn build
```

## PM2

Os apps são gerenciados pelo PM2 via `ecosystem.config.js` na raiz do projeto.
