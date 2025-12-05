# 🔧 Correções nos Docker Compose Files

**Data**: 2025-01-27  
**Situação**: RabbitMQ é um serviço externo gerenciado separadamente.

---

## ✅ Situação Atual

### RabbitMQ é um Serviço Externo

O RabbitMQ é gerenciado em um **serviço separado** com:

- **Dockerfile customizado** com plugins:
    - `rabbitmq_delayed_message_exchange` (v4.2.0)
    - `rabbitmq_management`
    - `rabbitmq_prometheus`
- **`definitions.json`** com configuração completa:
    - VHosts: `kodus-ast`, `kodus-ai`
    - Exchanges: `orchestrator.exchange.delayed`, `orchestrator.exchange.dlx`
    - Queues e bindings pré-configurados
- **`rabbitmq.conf`** com configurações específicas
- **Rede `shared-network`** para comunicação entre serviços

**Não deve estar** nos docker-compose files da aplicação principal.

---

## 📋 Configuração Correta dos Docker Compose

### 1. `docker-compose.dev.small.yml`

**Status**: ✅ **Correto**

- ❌ **Não tem** serviço RabbitMQ (correto - é externo)
- ❌ **Não tem** dependência de RabbitMQ (correto - é externo)
- ✅ Conecta ao RabbitMQ via `shared-network`
- ✅ Rede `shared-network` configurada como `external: true`

### 2. `docker-compose.dev.yml`

**Status**: ✅ **Correto**

- ❌ **Não tem** serviço RabbitMQ (correto - é externo)
- ❌ **Não tem** dependência de RabbitMQ (correto - é externo)
- ✅ Conecta ao RabbitMQ via `shared-network`
- ✅ Rede `shared-network` configurada como `external: true`

### 3. `docker-compose.dev.monorepo.yml`

**Status**: ⚠️ **Tem RabbitMQ definido**

Este arquivo **tem** o serviço RabbitMQ definido. Isso pode ser útil para desenvolvimento local quando o serviço externo não está disponível, mas normalmente deve usar o RabbitMQ externo.

**Recomendação**: Se o RabbitMQ externo estiver sempre disponível, considerar remover ou comentar o serviço RabbitMQ deste arquivo.

---

## 🔗 Conexão com RabbitMQ Externo

### Configuração do Serviço RabbitMQ

O serviço RabbitMQ externo deve estar configurado assim:

```yaml
services:
    rabbitmq:
        build:
            context: .
            dockerfile: Dockerfile
        container_name: rabbitmq-local
        hostname: ${RABBITMQ_HOSTNAME:-rabbitmq-local}
        ports:
            - '5672:5672'
            - '15672:15672' # Management UI
            - '15692:15692' # Métricas Prometheus
        volumes:
            - rabbitmq-data:/var/lib/rabbitmq
        networks:
            - monitoring-network
            - shared-network # ← Rede compartilhada
        healthcheck:
            test: ['CMD', 'rabbitmq-diagnostics', '-q', 'check_running']
```

### Variáveis de Ambiente da Aplicação

```env
# RabbitMQ (serviço externo)
# Usar hostname do container: rabbitmq-local (ou o configurado)
API_RABBITMQ_URL=amqp://dev:password@rabbitmq-local:5672/kodus-ai

# VHost (definido no definitions.json)
API_RABBITMQ_VHOST=kodus-ai

# Ou, se usando variáveis:
API_RABBITMQ_URL=amqp://dev:password@${RABBITMQ_HOSTNAME:-rabbitmq-local}:5672/kodus-ai
```

**Nota**:

- Usuário: `dev` (definido no `definitions.json`)
- Senha: Definida no `definitions.json` (não usar `guest`)
- VHost: `kodus-ai` (para workflow queue)

---

## 📋 VHosts e Exchanges Configurados

Baseado no `definitions.json` fornecido:

### VHosts

- **`kodus-ast`** - Para serviços AST (análise de código)
- **`kodus-ai`** - Para workflow queue e outros serviços principais

### Exchanges (vhost: `kodus-ai`)

- **`orchestrator.exchange.delayed`** - Delayed messages (tipo: `x-delayed-message`)
- **`orchestrator.exchange.dlx`** - Dead letter exchange (tipo: `topic`)

### Queues (vhost: `kodus-ai`)

- **`dlx.queue`** - Dead letter queue
- **`codeReviewFeedback.syncCodeReviewReactions.queue`** - Queue específica

**Nota**: O workflow queue provavelmente cria suas próprias exchanges/queues dinamicamente via código NestJS (`@golevelup/nestjs-rabbitmq`).

---

## 🔍 Verificação

Para verificar se RabbitMQ externo está rodando:

```bash
# Verificar container
docker ps | grep rabbitmq-local

# Verificar logs
docker logs rabbitmq-local

# Verificar rede compartilhada
docker network ls | grep shared-network

# Acessar Management UI
# http://localhost:15672
# Usuário: dev / Senha: (definido no definitions.json)
```

---

## 🚀 Como Rodar

### 1. Subir RabbitMQ Externo Primeiro

```bash
# No diretório do serviço RabbitMQ
docker compose up -d

# Verificar se está rodando
docker ps | grep rabbitmq-local
```

### 2. Subir Aplicação

```bash
# A aplicação conecta ao RabbitMQ via shared-network
yarn docker:up

# Ou para monorepo
yarn docker:up:monorepo
```

### 3. Verificar Conexão

```bash
# Health check da aplicação
yarn dev:health-check

# Verificar logs da aplicação para erros de conexão RabbitMQ
yarn dev:logs
```

---

## 📝 Notas Importantes

1. **RabbitMQ é serviço externo** - não está nos docker-compose da aplicação
2. **Rede compartilhada obrigatória** - serviços precisam estar na mesma rede (`shared-network`)
3. **VHost específico** - usar `kodus-ai` para workflow queue
4. **Credenciais** - usar usuário `dev` (definido no definitions.json), não `guest`
5. **Management UI** - disponível em `localhost:15672` para debug
6. **Métricas** - disponíveis em `localhost:15692` (Prometheus)
7. **Plugins** - delayed-message-exchange está habilitado (necessário para retry/delayed jobs)

---

## ✅ Checklist de Verificação

- [x] `docker-compose.dev.small.yml` **não tem** RabbitMQ (correto)
- [x] `docker-compose.dev.yml` **não tem** RabbitMQ (correto)
- [x] `docker-compose.dev.monorepo.yml` tem RabbitMQ (para dev local opcional)
- [x] Serviços conectam via `shared-network`
- [x] Variáveis de ambiente configuradas corretamente
- [x] Documentação atualizada

---

## 🔧 Troubleshooting

### Problema: Aplicação não consegue conectar ao RabbitMQ

**Solução**:

1. Verificar se RabbitMQ externo está rodando:

    ```bash
    docker ps | grep rabbitmq-local
    ```

2. Verificar se estão na mesma rede:

    ```bash
    docker network inspect shared-network
    ```

3. Verificar hostname na URL:

    ```env
    # Usar hostname do container, não localhost
    API_RABBITMQ_URL=amqp://dev:password@rabbitmq-local:5672/kodus-ai
    ```

4. Verificar credenciais no `definitions.json`

### Problema: VHost não encontrado

**Solução**:

- Verificar se `kodus-ai` está definido no `definitions.json`
- Verificar se usuário `dev` tem permissões no vhost `kodus-ai`

---

**Última atualização**: 2025-01-27
