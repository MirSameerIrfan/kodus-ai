# Recomendação: Arquitetura Simples para Open Source + Self-Hosted

## 🎯 Contexto

**Preocupações**:

- ✅ Facilidade para desenvolvedores iniciantes
- ✅ Facilidade de publicação (open source)
- ✅ Facilidade para clientes self-hosted
- ✅ Simplicidade e bem construído

---

## ✅ Boa Notícia: Produção JÁ É Simples!

### Situação Atual (Produção)

**Já existe**:

- ✅ `Dockerfile.prod` único (1 Dockerfile)
- ✅ `docker-compose.prod.yml` simples (1 serviço)
- ✅ PM2 gerencia tudo internamente (`ecosystem.config.js`)
- ✅ GitHub Actions publica 1 imagem (`ghcr.io/kodus-ai`)

**Cliente self-hosted faz**:

```bash
docker pull ghcr.io/kodus-ai/kodus-ai:latest
docker run -p 3001:3001 kodus-ai
```

**Simples!** ✅

---

## ⚠️ Problema: Desenvolvimento Está Complexo

### Situação Atual (Desenvolvimento)

**Criamos**:

- ❌ 3 Dockerfiles separados (`Dockerfile.webhook-handler.dev`, etc.)
- ❌ `docker-compose.dev.monorepo.yml` com 3 serviços
- ❌ Scripts complexos para build/start individuais

**Desenvolvedor iniciante precisa entender**:

- 3 Dockerfiles diferentes
- 2 docker-compose diferentes
- Quando usar qual?

**Complexo demais!** ❌

---

## 💡 Solução: Simplificar Desenvolvimento

### Estrutura Recomendada

**Código**: Manter `apps/` separados ✅ (organização)
**Docker Dev**: Dockerfile único ✅ (simplicidade)
**Docker Prod**: Dockerfile único ✅ (já existe, manter)
**Docker Monorepo**: Opcional, para casos específicos ✅

---

## 📋 Estrutura Final Recomendada

```
apps/
  ├── webhook-handler/     # Código separado (organização)
  ├── api-rest/
  └── worker/

DockerFiles/
  ├── Dockerfile.dev       # Desenvolvimento (único, simples) ⭐
  ├── Dockerfile.prod      # Produção (único, já existe) ✅
  └── Dockerfile.*.dev     # Opcional (para casos específicos)

docker-compose.dev.yml           # Desenvolvimento (tudo junto via PM2) ⭐
docker-compose.dev.monorepo.yml  # Opcional (para testar separado)
docker-compose.prod.yml          # Produção (1 serviço, já existe) ✅
```

---

## 🎯 Mudanças Necessárias

### 1. Ajustar `Dockerfile.dev` para Nova Estrutura

**Atual**: Compila `src/` (estrutura antiga)
**Novo**: Compila `apps/` (estrutura nova)

```dockerfile
# Dockerfile.dev (único, simples)
FROM node:22.14.0-slim

WORKDIR /usr/src/app

# Instalar dependências
COPY package.json yarn.lock ./
RUN yarn install

# Copiar código
COPY . .

# Build todos os apps
RUN yarn build:apps

# Rodar via PM2 (ecosystem.config.js)
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "development"]
```

**Vantagens**:

- ✅ 1 Dockerfile para desenvolvimento
- ✅ Simples de entender
- ✅ Funciona "out of the box"

---

### 2. Ajustar `docker-compose.dev.yml` para Nova Estrutura

**Atual**: Usa estrutura antiga (`dist/src/main.js`)
**Novo**: Usa estrutura nova (`apps/*/dist/main.js`)

```yaml
services:
    kodus-orchestrator:
        build:
            context: .
            dockerfile: DockerFiles/Dockerfile.dev
        ports:
            - '3331:3331' # API REST
            - '3332:3332' # Webhook Handler
        volumes:
            - .:/usr/src/app
        # PM2 gerencia tudo internamente
```

**Vantagens**:

- ✅ 1 serviço simples
- ✅ PM2 gerencia processos internamente
- ✅ Desenvolvedor não precisa entender componentes

---

### 3. Manter `Dockerfile.prod` Como Está

**Já está correto!** ✅

- ✅ Compila tudo
- ✅ PM2 gerencia processos
- ✅ 1 imagem simples

**Apenas ajustar**:

- Build para usar `yarn build:apps` ao invés de `yarn build:production`

---

### 4. Dockerfiles Separados: Opcional

**Manter como estão** (para casos específicos):

- ✅ `Dockerfile.webhook-handler.dev` (opcional)
- ✅ `Dockerfile.api-rest.dev` (opcional)
- ✅ `Dockerfile.worker.dev` (opcional)

**Uso**: Apenas quando desenvolvedor precisa testar componente isoladamente.

---

## 📊 Comparação: Antes vs Depois

### Para Desenvolvedor Iniciante

| Aspecto                       | Antes (Separado) | Depois (Simplificado) |
| ----------------------------- | ---------------- | --------------------- |
| **Dockerfiles principais**    | 3                | 1                     |
| **Docker Compose principais** | 2                | 1                     |
| **Comando para começar**      | Complexo         | `docker compose up`   |
| **Facilidade**                | Difícil          | Fácil                 |

---

### Para Cliente Self-Hosted

| Aspecto                 | Antes | Depois   |
| ----------------------- | ----- | -------- |
| **Imagens para baixar** | 1     | 1 ✅     |
| **Comandos para rodar** | 1     | 1 ✅     |
| **Complexidade**        | Baixa | Baixa ✅ |

**Não muda!** ✅ (já era simples)

---

## 🎯 Resposta Direta

### Faz Sentido Ter Apps Separados?

**SIM, para código** ✅

- Mantém código organizado
- Facilita manutenção
- Permite escalar depois

**NÃO, para Dockerfiles separados obrigatórios** ❌

- Complexo demais para desenvolvedores
- Desnecessário para produção (já é simples)

---

### Precisamos Disso?

**Para Desenvolvimento**: **SIM** (mas simplificado - 1 Dockerfile principal)
**Para Produção/Self-Hosted**: **NÃO** (já é simples - 1 imagem)

---

## 💡 Recomendação Final

### Estrutura Ideal

1. **Código**: `apps/` separados ✅ (organização)
2. **Docker Dev**: Dockerfile único ✅ (simplicidade)
3. **Docker Prod**: Dockerfile único ✅ (já existe, manter)
4. **Docker Monorepo**: Opcional ✅ (para casos específicos)

**Resultado**:

- ✅ Simples para desenvolvedores (1 Dockerfile principal)
- ✅ Simples para publicação (1 imagem - já existe)
- ✅ Simples para self-hosted (1 comando - já existe)
- ✅ Flexível (pode testar componentes separadamente se quiser)

---

## 🚀 Próximos Passos

1. **Ajustar `Dockerfile.dev`** para compilar `apps/`
2. **Ajustar `docker-compose.dev.yml`** para usar nova estrutura
3. **Ajustar `Dockerfile.prod`** para usar `yarn build:apps`
4. **Manter Dockerfiles separados** como opcionais
5. **Documentar** estrutura simplificada

---

**Quer que eu ajuste para essa estrutura simplificada?**
