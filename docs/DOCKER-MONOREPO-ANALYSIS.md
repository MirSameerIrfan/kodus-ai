# Análise: Dockerfiles e Docker Compose com Nova Estrutura de Monorepo

## 🎯 Pergunta

**Os Dockerfiles, docker-compose e scripts estão coerentes com a nova estrutura de monorepo?**
**É possível rodar apenas o webhook handler?**

---

## 🔍 Análise Atual

### Dockerfiles

**Problemas Identificados**:

- ❌ Dockerfiles ainda apontam para `dist/src/main.js` (estrutura antiga)
- ❌ Build ainda compila tudo junto (`nest build` na raiz)
- ❌ Não há Dockerfiles específicos para cada app

**Estrutura Atual**:

```dockerfile
# Dockerfile.dev / Dockerfile.prod
RUN yarn build  # Compila tudo na raiz
CMD ["node", "dist/src/main.js"]  # Apenas API REST
```

**Estrutura Necessária**:

```dockerfile
# Dockerfile.dev / Dockerfile.prod
RUN yarn build:webhook-handler  # Compila apenas webhook handler
CMD ["node", "apps/webhook-handler/dist/main.js"]  # Webhook handler
```

---

### Docker Compose

**Problemas Identificados**:

- ❌ Apenas um serviço (`kodus-orchestrator`) que roda tudo
- ❌ Não há serviços separados para webhook-handler, api-rest, worker
- ❌ Não é possível rodar apenas um serviço

**Estrutura Atual**:

```yaml
services:
    kodus-orchestrator:
        build: ...
        command: node dist/src/main.js # Apenas API REST
```

**Estrutura Necessária**:

```yaml
services:
    webhook-handler:
        build:
            context: .
            dockerfile: DockerFiles/Dockerfile.webhook-handler.dev
        command: node apps/webhook-handler/dist/main.js
        ports:
            - '3332:3332'

    api-rest:
        build:
            context: .
            dockerfile: DockerFiles/Dockerfile.api-rest.dev
        command: node apps/api-rest/dist/main.js
        ports:
            - '3331:3331'

    worker:
        build:
            context: .
            dockerfile: DockerFiles/Dockerfile.worker.dev
        command: node apps/worker/dist/main.js
        # Sem portas (não tem HTTP)
```

---

### Scripts

**Problemas Identificados**:

- ❌ Scripts ainda usam estrutura antiga
- ❌ Não há scripts para build/start de apps individuais

---

## 🚀 Solução: Ajustar para Nova Estrutura

### Opção 1: Dockerfiles Separados por App (Recomendado)

**Criar**:

- `DockerFiles/Dockerfile.webhook-handler.dev`
- `DockerFiles/Dockerfile.api-rest.dev`
- `DockerFiles/Dockerfile.worker.dev`

**Vantagens**:

- ✅ Build otimizado por app
- ✅ Imagens menores
- ✅ Deploy independente
- ✅ Escala independente

---

### Opção 2: Dockerfile Único com Build Condicional

**Criar**:

- `DockerFiles/Dockerfile.dev` (com ARG para escolher app)

**Vantagens**:

- ✅ Um Dockerfile para todos
- ✅ Menos duplicação

**Desvantagens**:

- ⚠️ Build menos otimizado
- ⚠️ Imagem maior

---

## 📋 Checklist: O Que Precisa Ser Ajustado

### Dockerfiles

- [ ] Criar `Dockerfile.webhook-handler.dev`
- [ ] Criar `Dockerfile.api-rest.dev`
- [ ] Criar `Dockerfile.worker.dev`
- [ ] Ajustar build para compilar apenas o app necessário
- [ ] Ajustar CMD para apontar para novo path

### Docker Compose

- [ ] Criar serviços separados:
    - [ ] `webhook-handler`
    - [ ] `api-rest`
    - [ ] `worker`
- [ ] Ajustar ports para cada serviço
- [ ] Ajustar volumes para cada serviço
- [ ] Ajustar environment variables para cada serviço
- [ ] Ajustar depends_on se necessário

### Scripts

- [ ] Criar script para build de app específico
- [ ] Criar script para start de app específico
- [ ] Atualizar scripts existentes

### Package.json

- [ ] Adicionar scripts para build de apps individuais:
    - `build:webhook-handler`
    - `build:api-rest`
    - `build:worker`
- [ ] Adicionar scripts para start de apps individuais:
    - `start:webhook-handler`
    - `start:api-rest`
    - `start:worker`

---

## 🎯 Resposta: É Possível Rodar Apenas o Webhook Handler?

**SIM, mas precisa ajustar!** ✅

**O Que Precisa Ser Feito**:

1. Criar Dockerfile específico para webhook-handler
2. Criar serviço no docker-compose para webhook-handler
3. Criar script para build/start apenas webhook-handler
4. Ajustar paths nos arquivos

---

## 💡 Recomendação

**Criar estrutura completa para rodar apps separadamente**:

1. **Dockerfiles separados** (mais otimizado)
2. **Docker Compose com serviços separados**
3. **Scripts para build/start individuais**
4. **Package.json com scripts para cada app**

**Tempo Estimado**: ~2-3 horas

---

**Quer que eu crie os Dockerfiles, docker-compose e scripts ajustados agora?**
