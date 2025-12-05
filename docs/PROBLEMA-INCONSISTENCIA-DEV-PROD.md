# 🚨 Problema: Inconsistência Dev vs Prod/QA

**Data**: 2025-01-27  
**Problema Identificado**: Desenvolvimento não está alinhado com Produção/QA

---

## ✅ Arquitetura REAL de Produção/QA

### Como Funciona em Produção/QA

**1 Container** com **PM2** gerenciando **3 processos**:

```yaml
# docker-compose.prod.yml / docker-compose.qa.yml
services:
  kodus-orchestrator:
    image: kodus-ai:latest
    # 1 container único
```

**Dockerfile.prod/qa**:
```dockerfile
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
```

**PM2 (`ecosystem.config.js`)** roda 3 processos no mesmo container:
1. `webhook-handler` (porta 3332) - `apps/webhooks/dist/main.js`
2. `api-rest` (porta 3331) - `apps/api/dist/main.js`
3. `workflow-worker` (sem HTTP) - `apps/worker/dist/main.js`

**Arquitetura**: **Monolito Modular**
- ✅ 1 deploy
- ✅ 1 container
- ✅ PM2 gerencia processos internamente
- ✅ Código organizado em `apps/` (separação lógica, não física)

---

## ❌ Arquitetura de Desenvolvimento (Atual)

### Forma 1: `dev.small` (Monolítico)

**1 Container** rodando **1 processo**:

```yaml
# docker-compose.dev.small.yml
services:
  kodus-orchestrator:
    # Roda src/main.ts (tudo junto)
```

**Dockerfile.dev.small**:
```dockerfile
ENTRYPOINT ["dev-entrypoint.sh"]
# Roda: nodemon → nest start → src/main.ts
```

**Problema**: 
- ❌ Não usa PM2
- ❌ Não roda os 3 processos separados
- ❌ Não reflete arquitetura de produção
- ❌ `src/main.ts` roda tudo junto (ApiModule completo)

---

### Forma 2: `dev.monorepo` (Microserviços)

**3 Containers** separados:

```yaml
# docker-compose.dev.monorepo.yml
services:
  webhook-handler:  # Container 1
  api-rest:         # Container 2
  worker:           # Container 3
```

**Problema**:
- ❌ 3 containers (prod usa 1)
- ❌ Microserviços (prod usa monolith modular)
- ❌ Não reflete arquitetura de produção
- ❌ Complexidade desnecessária

---

### Forma 3: `dev.yml` (PM2) ⚠️ **Mais Próximo**

**1 Container** com **PM2**:

```yaml
# docker-compose.dev.yml
services:
  kodus-orchestrator:
    # Usa PM2 (como prod)
```

**Dockerfile.dev**:
```dockerfile
CMD ["yarn", "start:dev"]
# Mas não está claro se usa PM2 ou não
```

**Status**: ⚠️ Parece correto, mas precisa verificar

---

## 🎯 Problema Principal

### Docker Deveria Simular QA/Prod

**Você está certo!** ✅

Docker serve para ter o mesmo ambiente de QA e Prod. Mas:

| Ambiente | Arquitetura | Container | Processos |
|----------|-------------|-----------|-----------|
| **Prod/QA** | Monolito Modular | 1 | PM2 (3 processos) |
| **Dev.small** | Monolítico | 1 | 1 processo (src/main.ts) |
| **Dev.monorepo** | Microserviços | 3 | 1 processo cada |
| **Dev.yml** | ? | 1 | PM2? |

**Inconsistência clara!** ❌

---

## 💡 Solução: Alinhar Dev com Prod

### Arquitetura Correta para Dev

**Deve ser igual a Prod/QA**:

1. ✅ **1 Container** (não 3)
2. ✅ **PM2** gerencia processos (não src/main.ts)
3. ✅ **3 processos** no mesmo container:
   - `webhook-handler` (apps/webhooks)
   - `api-rest` (apps/api)
   - `workflow-worker` (apps/worker)
4. ✅ **Hot reload** para desenvolvimento

---

## 🔧 Como Deveria Ser

### Dockerfile.dev (Correto)

```dockerfile
# Similar ao Dockerfile.prod, mas com hot reload
FROM node:22-slim

WORKDIR /usr/src/app

# Instalar dependências
COPY package.json yarn.lock ./
RUN yarn install

# Copiar código
COPY . .

# Instalar PM2
RUN yarn global add pm2

# Rodar PM2 com hot reload (nodemon ou watch)
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--watch"]
```

### docker-compose.dev.yml (Correto)

```yaml
services:
  kodus-orchestrator:
    build:
      dockerfile: DockerFiles/Dockerfile.dev
    ports:
      - "3331:3331"  # API REST
      - "3332:3332"  # Webhook Handler
    volumes:
      - .:/usr/src/app  # Hot reload
    # 1 container, PM2 gerencia processos
```

**Igual a Prod, mas com hot reload!** ✅

---

## 📋 O Que Fazer

### Opção 1: Corrigir `dev.yml` para Usar PM2

**Tornar `dev.yml` o padrão**:
- ✅ Usar PM2 (como prod)
- ✅ Rodar 3 processos (como prod)
- ✅ Hot reload com `--watch`
- ✅ 1 container (como prod)

**Remover `dev.small`**:
- ❌ Não reflete prod
- ❌ Confunde desenvolvedores

**Manter `dev.monorepo` como opcional**:
- ⚠️ Apenas para testar separação física
- ⚠️ Não é a arquitetura real

---

### Opção 2: Simplificar Tudo

**Uma única forma de dev**:
- ✅ `docker-compose.dev.yml` com PM2
- ✅ Igual a prod, mas com hot reload
- ✅ Remover `dev.small` e `dev.monorepo`

---

## 🎯 Recomendação

### Alinhar Dev com Prod

1. **Corrigir `dev.yml`** para usar PM2 (como prod)
2. **Remover `dev.small`** (não reflete prod)
3. **Manter `dev.monorepo`** como opcional (para casos específicos)
4. **Documentar** que dev deve simular prod

**Resultado**:
- ✅ Dev = Prod (com hot reload)
- ✅ Mesma arquitetura
- ✅ Menos confusão
- ✅ Docker serve seu propósito real

---

## 📝 Resumo

**Problema**: Dev não está alinhado com Prod/QA

**Causa**: Múltiplas formas de dev que não refletem produção

**Solução**: Alinhar dev com prod (PM2, 1 container, 3 processos)

**Ação**: Corrigir `dev.yml` para usar PM2 e remover `dev.small`

---

**Você estava certo em questionar!** ✅

Docker deveria simular QA/Prod, mas não estava fazendo isso.

