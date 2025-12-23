# Deploy (ECS / ECR)

Este repo suporta build de **3 imagens** (1 processo por container) via `docker/Dockerfile`:

- `api` → `node dist/apps/api/main.js`
- `webhooks` → `node dist/apps/webhooks/main.js`
- `worker` → `node dist/apps/worker/main.js`

## Build local (targets)

```bash
docker build -f docker/Dockerfile --target api -t kodus-api:local .
docker build -f docker/Dockerfile --target webhooks -t kodus-webhooks:local .
docker build -f docker/Dockerfile --target worker -t kodus-worker:local .
```

## Build/push no ECR (local)

Requisitos: `aws` CLI + Docker.

```bash
export AWS_REGION=us-east-1
export ECR_REGISTRY="123456789012.dkr.ecr.us-east-1.amazonaws.com"
export TAG="$(git rev-parse HEAD)"

export ECR_REPOSITORY_API="kodus-orchestrator-api-qa"
export ECR_REPOSITORY_WEBHOOKS="kodus-orchestrator-webhook-qa"
export ECR_REPOSITORY_WORKER="kodus-orchestrator-worker-qa"

./scripts/build-ecr-images.sh
./scripts/push-ecr-images.sh
```

## CI/CD (GitHub Actions) — QA (GitOps)

### Workflows (repo do código)

- Deploy green (build/push + PR no repo infra): `.github/workflows/qa-build-push-and-pr-green.yml`
- Promote traffic (PR de weights): `.github/workflows/qa-promote-traffic-pr.yml`

### Configurar GitHub Environments (recomendado)

Crie o environment `qa` em `Settings → Environments` e mova os secrets de deploy (AWS + token do infra) para ele. Assim você consegue:

- limitar quem pode aprovar/executar deploy (required reviewers)
- garantir que secrets só são liberados para jobs do environment

### Variáveis necessárias (repo → Settings → Actions → Variables)

- `ECR_REPOSITORY_API`, `ECR_REPOSITORY_WEBHOOKS`, `ECR_REPOSITORY_WORKER`
- `INFRA_REPO` (ex.: `kodus-ai/kodus-infra`)
- `INFRA_BASE_BRANCH` (ex.: `main`)
- `INFRA_TFVARS_PATH` (QA: `envs/aws/qa/releases/orchestrator.auto.tfvars.json`; PROD: `envs/aws/prod/releases/orchestrator.auto.tfvars.json`)

### Secrets necessárias

- `AWS_REGION`
- `AWS_ROLE_TO_ASSUME` (OIDC; evitar keys long-lived em repo open source)
- `INFRA_GITHUB_APP_PRIVATE_KEY` (GitHub App private key; usado para gerar token efêmero por execução)

### Variables necessárias

- `INFRA_GITHUB_APP_ID` (GitHub App id; usado para gerar token efêmero por execução)

## Scripts GitOps (edição de tfvars)

Os workflows chamam scripts locais para manter o YAML mais enxuto:

- `scripts/update-tfvars-green.sh:1` (atualiza `*_green_image` + `*_green_desired_count`)
- `scripts/update-tfvars-promote-weights.sh:1` (ajusta pesos para 100% green)

## Shutdown / drain (worker)

No deploy (SIGTERM), o worker fecha consumidores RabbitMQ de forma graciosa:
- cancela consumers (para de receber novas mensagens)
- aguarda handlers em andamento finalizarem

Implementado em `apps/worker/src/worker-drain.service.ts:1`.

## Portas (QA / ECS)

- API usa `API_PORT`.
- Webhooks usa `WEBHOOKS_PORT` (obrigatório).

## CI/CD (GitHub Actions) — PROD (GitOps)

PROD roda **somente por release** (tag `x.y.z`, ex.: `1.0.92`) e usa o environment `production` com aprovação.

### Workflows (repo do código)

- Deploy green (release → build/push + PR no repo infra): `.github/workflows/prod-build-push-and-pr-green.yml`
- Promote traffic (manual, PR de weights): `.github/workflows/prod-promote-traffic-pr.yml`

### Workflows legados (não usados no GitOps)

- `.github/workflows/build-and-push-production.yml` (monolito/PM2) — agora manual e com `environment: production`
- `.github/workflows/deploy-to-prod.yml` (EC2/SSH) — manual e com `environment: production`

### Contrato com o infra (PROD)

- `INFRA_TFVARS_PATH`: `envs/aws/prod/releases/orchestrator.auto.tfvars.json`
- ECR repos:
  - `kodus-orchestrator-api-prod`
  - `kodus-orchestrator-webhook-prod`
  - `kodus-orchestrator-worker-prod`

## Contrato GitOps (kodus-infra)

Enviar para o time do `kodus-infra`:

1) Paths GitOps (corrigidos)
- QA: `envs/aws/qa/releases/orchestrator.auto.tfvars.json`
- PROD: `envs/aws/prod/releases/orchestrator.auto.tfvars.json`

2) Variáveis que o workflow deve editar (somente essas)
- `api_green_image`
- `webhook_green_image`
- `worker_green_image`
- `api_green_desired_count`
- `webhook_green_desired_count`
- `worker_green_desired_count`
- `api_blue_weight`
- `api_green_weight`
- `webhook_blue_weight`
- `webhook_green_weight`

3) Regras de segurança (open source)
- Não usar secrets em PR de fork.
- Deploy/PR para infra só em `push` para `main` ou `workflow_dispatch`.
- PR de infra deve tocar só os arquivos de release acima.

4) ECR PROD
- `kodus-orchestrator-api-prod`
- `kodus-orchestrator-webhook-prod`
- `kodus-orchestrator-worker-prod`
