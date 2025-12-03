# Arquitetura: Monolito Modular

## 🎯 Definição

**Monolito Modular** = **1 deploy** com **código organizado em módulos**.

**NÃO é Microserviços** = Múltiplos deploys independentes.

---

## ✅ Características do Monolito Modular

### 1. Deploy Único

- ✅ **1 imagem Docker**
- ✅ **1 container**
- ✅ **1 comando**: `docker run kodus-ai`

---

### 2. Código Organizado em Módulos

- ✅ **`apps/` separados** (organização de código)
- ✅ **`src/` compartilhado** (código comum)
- ✅ **Separação lógica**, não física

---

### 3. Processos Gerenciados Internamente

- ✅ **PM2 gerencia processos** (`ecosystem.config.js`)
- ✅ **3 processos** no mesmo container:
  - `webhook-handler` (porta 3332)
  - `api-rest` (porta 3331)
  - `worker` (sem porta HTTP)

---

## 📊 Comparação: Monolito Modular vs Microserviços

| Aspecto | Monolito Modular (Atual) | Microserviços |
|---------|-------------------------|---------------|
| **Deploy** | 1 deploy | Múltiplos deploys |
| **Imagens Docker** | 1 imagem | Múltiplas imagens |
| **Containers** | 1 container | Múltiplos containers |
| **Código** | Organizado em módulos | Separado fisicamente |
| **Processos** | PM2 gerencia internamente | Containers separados |
| **Escalabilidade** | Escala tudo junto | Escala componentes separadamente |
| **Complexidade** | Baixa | Alta |
| **Self-Hosted** | Simples (1 comando) | Complexo (múltiplos comandos) |

---

## 🎯 Estrutura Atual: Monolito Modular

### Código Organizado

```
kodus-ai/
├── apps/                    # Módulos organizados (não separados fisicamente)
│   ├── webhook-handler/     # Módulo webhook
│   ├── api-rest/            # Módulo API REST
│   └── worker/              # Módulo worker
│
├── src/                      # Código compartilhado
│   ├── core/
│   ├── modules/
│   └── ...
│
├── ecosystem.config.js       # PM2 gerencia 3 processos
├── Dockerfile.prod           # 1 Dockerfile único
└── docker-compose.prod.yml   # 1 serviço único
```

---

### Deploy Único

**1 Dockerfile**:
```dockerfile
# Dockerfile.prod
RUN yarn build:apps          # Builda todos os módulos
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
```

**1 Container**:
```yaml
# docker-compose.prod.yml
services:
  kodus-ai:
    image: kodus-ai:latest
    ports:
      - "3331:3331"  # API REST
      - "3332:3332"  # Webhook Handler
```

**1 Comando**:
```bash
docker run kodus-ai
```

---

### Processos Internos (PM2)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    { name: 'webhook-handler', script: './apps/webhook-handler/dist/main.js' },
    { name: 'api-rest', script: './apps/api-rest/dist/main.js' },
    { name: 'worker', script: './apps/worker/dist/main.js' }
  ]
};
```

**PM2 gerencia 3 processos no mesmo container**.

---

## ❌ O Que NÃO É: Microserviços

### Se Fosse Microserviços (NÃO é)

**Múltiplos Deploys**:
```bash
docker run webhook-handler:latest
docker run api-rest:latest
docker run worker:latest
```

**Múltiplos Containers**:
```yaml
services:
  webhook-handler:
    image: webhook-handler:latest
  api-rest:
    image: api-rest:latest
  worker:
    image: worker:latest
```

**Complexo para Self-Hosted**:
- Cliente precisa baixar 3 imagens
- Cliente precisa rodar 3 containers
- Cliente precisa configurar rede entre containers

---

## ✅ Vantagens do Monolito Modular

### 1. Simplicidade

- ✅ **1 deploy** simples
- ✅ **1 imagem** Docker
- ✅ **1 comando** para rodar
- ✅ **Fácil para self-hosted**

---

### 2. Código Organizado

- ✅ **`apps/` separados** (organização)
- ✅ **`src/` compartilhado** (reuso)
- ✅ **Separação lógica** clara

---

### 3. Escalabilidade Interna

- ✅ **PM2 pode escalar processos** internamente
- ✅ **Pode aumentar workers** sem rede externa
- ✅ **Menos overhead** de rede

---

### 4. Self-Hosted Friendly

- ✅ **Cliente baixa 1 imagem**
- ✅ **Cliente roda 1 comando**
- ✅ **Funciona "out of the box"**

---

## 🎯 Implicações para Estrutura

### ✅ O Que Faz Sentido

1. **Código em `apps/`** ✅ (organização)
2. **1 Dockerfile** ✅ (deploy único)
3. **1 docker-compose** ✅ (1 serviço)
4. **PM2 gerencia processos** ✅ (internamente)
5. **1 `nest-cli.json`** ✅ (monorepo)

---

### ❌ O Que NÃO Faz Sentido

1. **Dockerfiles separados** ❌ (não precisa)
2. **docker-compose com serviços separados** ❌ (não precisa)
3. **Múltiplas imagens Docker** ❌ (não precisa)
4. **Deploy separado por componente** ❌ (não precisa)

---

## 📋 Estrutura Ideal para Monolito Modular

### Código

```
apps/
  ├── webhook-handler/     # Módulo (organização)
  ├── api-rest/            # Módulo (organização)
  └── worker/              # Módulo (organização)

src/
  └── core/                # Código compartilhado
```

---

### Deploy

```
DockerFiles/
  └── Dockerfile.prod      # 1 Dockerfile único

docker-compose.prod.yml    # 1 serviço único

ecosystem.config.js        # PM2 gerencia processos
```

---

### Desenvolvimento

```
DockerFiles/
  └── Dockerfile.dev       # 1 Dockerfile único (opcional)

docker-compose.dev.yml     # 1 serviço único (opcional)
```

---

## 🎯 Resposta Direta

### Estamos de Acordo?

**SIM!** ✅

**Você tem**:
- ✅ **Monolito Modular** (1 deploy, código organizado)
- ✅ **NÃO Microserviços** (múltiplos deploys)

**Estrutura atual**:
- ✅ Código em `apps/` (organização)
- ✅ 1 Dockerfile (deploy único)
- ✅ PM2 gerencia processos (internamente)
- ✅ Self-hosted friendly (simples)

---

## 🚀 Ajustes Necessários

### Remover Complexidade Desnecessária

1. ❌ **Dockerfiles separados** (`Dockerfile.webhook-handler.dev`, etc.)
   - ✅ Manter apenas `Dockerfile.dev` e `Dockerfile.prod`

2. ❌ **docker-compose.dev.monorepo.yml** (serviços separados)
   - ✅ Manter apenas `docker-compose.dev.yml` (1 serviço)

3. ❌ **Scripts complexos** para build/start individuais
   - ✅ Manter apenas `yarn build:apps` e `yarn start:prod`

---

## 💡 Recomendação Final

### Estrutura Simplificada

**Código**: `apps/` separados ✅ (organização)
**Deploy**: 1 Dockerfile ✅ (simplicidade)
**Processos**: PM2 interno ✅ (gerenciamento)
**Self-Hosted**: 1 imagem ✅ (simplicidade)

**Resultado**:
- ✅ Simples para desenvolvedores
- ✅ Simples para publicação
- ✅ Simples para self-hosted
- ✅ Código organizado

---

**Quer que eu simplifique removendo Dockerfiles e docker-compose desnecessários?**

