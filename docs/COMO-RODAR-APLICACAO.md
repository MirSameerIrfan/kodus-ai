# 🚀 Como Rodar a Aplicação

## 📋 Pré-requisitos

- **Node.js** (LTS version) - Verificar com `node --version`
- **Yarn** - Verificar com `yarn --version`
- **Docker** e **Docker Compose** - Verificar com `docker --version`
- **OpenSSL** (geralmente já instalado no macOS/Linux)

## 🎯 Formas de Rodar

### 1️⃣ **Setup Inicial (Primeira Vez)** ⭐ Recomendado

Para primeira execução ou setup completo:

```bash
yarn setup
```

Este comando automatiza:

- ✅ Verificação de dependências
- 📦 Instalação de pacotes
- 🔧 Criação e configuração do `.env`
- 🔐 Geração de chaves automáticas
- 🐳 Setup de redes Docker
- 🚀 Inicialização de serviços
- 📊 Execução de migrations
- 🌱 Seed de dados iniciais

---

### 2️⃣ **Desenvolvimento Local (Docker Compose)**

#### Opção A: Setup Pequeno (Recomendado para Dev)

```bash
# Subir serviços
yarn docker:up

# Ou com watch mode
yarn docker:up:watch

# Ver logs
yarn docker:logs

# Parar serviços
yarn docker:down
```

**Arquivo usado:** `docker-compose.dev.small.yml`

#### Opção B: Setup Completo (Todos os serviços)

```bash
# Subir todos os serviços
yarn docker:up:complete

# Parar
yarn docker:down:complete
```

**Arquivo usado:** `docker-compose.dev.yml`

#### Opção C: Monorepo (Aplicações Separadas)

```bash
# Subir tudo
yarn docker:up:monorepo

# Ou subir aplicações específicas:
yarn docker:up:webhook-handler  # Apenas webhook handler
yarn docker:up:api-rest         # Apenas API REST
yarn docker:up:worker          # Apenas Worker

# Parar
yarn docker:down:monorepo
```

**Arquivo usado:** `docker-compose.dev.monorepo.yml`

---

### 3️⃣ **Desenvolvimento Local (Sem Docker)**

Para rodar diretamente no Node.js (requer bancos rodando):

```bash
# Instalar dependências
yarn install

# Rodar migrations
yarn migrate:dev

# Rodar aplicação principal
yarn start:dev

# Ou rodar aplicações separadas:
yarn start:webhooks  # Webhook handler
yarn start:api      # API REST
yarn start:worker   # Worker
```

---

### 4️⃣ **Produção**

```bash
# Build
yarn build:production

# Rodar
yarn start:prod
```

---

## 🔧 Comandos Úteis

### Gerenciamento de Serviços

```bash
# Health check
yarn dev:health-check

# Restart completo
yarn dev:restart

# Parar tudo
yarn dev:stop

# Limpar e reiniciar (remove cache Docker)
yarn dev:clean

# Ver logs
yarn dev:logs
```

### Migrations

```bash
# Rodar migrations
yarn migrate:dev

# Reverter última migration
yarn migration:revert

# Gerar nova migration
yarn migration:generate NomeDaMigration
```

### Build

```bash
# Build padrão
yarn build

# Build rápido (com webpack)
yarn build:fast

# Build incremental
yarn build:incremental

# Build aplicações específicas
yarn build:webhooks
yarn build:api
yarn build:worker
yarn build:apps  # Todas as apps
```

---

## 🌐 Endpoints

Quando rodando, os serviços ficam disponíveis em:

- **API Health:** http://localhost:3331/health
- **API Base:** http://localhost:3331
- **PostgreSQL:** localhost:5432
- **MongoDB:** localhost:27017
- **RabbitMQ:** Serviço externo (conecta via shared-network)
    - AMQP: `rabbitmq-local:5672` (ou hostname configurado)
    - Management UI: http://localhost:15672
    - VHost: `kodus-ai` (para workflow queue)

---

## 🔐 Configuração de Ambiente

### Arquivo `.env`

O arquivo `.env` é criado automaticamente pelo `yarn setup`, mas você pode configurar manualmente:

```bash
cp .env.example .env
```

**Variáveis importantes:**

```env
# API Keys (obrigatórias)
API_OPEN_AI_API_KEY=your_openai_key
# ou
API_GOOGLE_AI_API_KEY=your_google_key
# ou
API_ANTHROPIC_API_KEY=your_anthropic_key

# Banco de dados PostgreSQL
API_PG_DB_HOST=localhost
API_PG_DB_USERNAME=postgres
API_PG_DB_PASSWORD=postgres
API_PG_DB_DATABASE=kodus

# MongoDB
API_MG_DB_USERNAME=admin
API_MG_DB_PASSWORD=admin
API_MG_DB_DATABASE=kodus
API_MONGODB_URI=mongodb://admin:admin@localhost:27017/kodus

# RabbitMQ (serviço externo - necessário para workflow queue)
# O RabbitMQ é gerenciado em um serviço separado com Dockerfile customizado
# Conecta via shared-network
API_RABBITMQ_URL=amqp://dev:password@rabbitmq-local:5672/kodus-ai
API_RABBITMQ_VHOST=kodus-ai

# Porta da API
API_PORT=3331

# Modo Cloud (true/false)
API_CLOUD_MODE=false
```

### Conectar a Ambientes Remotos (QA/Prod)

```bash
# Baixar variáveis do ambiente desejado
./scripts/fetch-env-qa.sh qa    # ou
./scripts/fetch-env-prod.sh prod

# Rodar com arquivo específico
ENV_FILE=.env.qa docker compose -f docker-compose.dev.yml up

# Ou definir variável de ambiente
API_DATABASE_ENV=production docker compose -f docker-compose.dev.yml up
```

---

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. **Porta já em uso**

```bash
# Verificar o que está usando a porta
lsof -i :3331  # ou :5432, :27017, etc

# Parar containers Docker
yarn docker:down

# Limpar tudo
yarn dev:clean
```

#### 2. **Erro de permissão Docker**

```bash
# Verificar se Docker está rodando
docker ps

# Se necessário, reiniciar Docker Desktop
```

#### 3. **Migrations não rodam**

```bash
# Verificar conexão com banco
yarn dev:health-check

# Rodar migrations manualmente
yarn migrate:dev
```

#### 4. **Dependências não instaladas**

```bash
# Limpar e reinstalar
rm -rf node_modules yarn.lock
yarn install
```

#### 5. **Container não sobe**

```bash
# Ver logs detalhados
docker compose -f docker-compose.dev.small.yml logs

# Rebuild da imagem
yarn docker:build

# Limpar volumes
docker volume prune
```

---

## 📚 Estrutura de Aplicações

A aplicação é um **monorepo** com múltiplas aplicações:

```
apps/
├── webhooks/    # Webhook handler (recebe eventos Git)
├── api/         # API REST (endpoints principais)
└── worker/      # Worker (processa jobs da fila)
```

### Rodar Aplicações Separadas

```bash
# Build específico
yarn build:webhooks
yarn build:api
yarn build:worker

# Rodar específico
yarn start:webhooks
yarn start:api
yarn start:worker
```

---

## ✅ Checklist de Setup

- [ ] Node.js instalado (`node --version`)
- [ ] Yarn instalado (`yarn --version`)
- [ ] Docker instalado (`docker --version`)
- [ ] Executado `yarn setup`
- [ ] Arquivo `.env` configurado
- [ ] API Keys configuradas
- [ ] Health check passou (`yarn dev:health-check`)
- [ ] Migrations rodadas (`yarn migrate:dev`)

---

## 🆘 Precisa de Ajuda?

- **Documentação completa:** [README-SETUP.md](../README-SETUP.md)
- **Contribuindo:** [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Issues:** Abra uma issue no GitHub

---

**Última atualização:** 2025-01-27
