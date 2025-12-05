# 🚨 Inconsistências de Nomenclatura

**Data**: 2025-01-27  
**Problema**: Múltiplos nomes sendo usados para o mesmo componente

---

## ✅ Nome Correto (Produção/QA)

**`kodus-orchestrator`** ✅

**Onde está correto**:

- ✅ `ecosystem.config.js` - processo PM2: `kodus-orchestrator`
- ✅ `docker-compose.prod.yml` - serviço: `kodus-orchestrator`
- ✅ `docker-compose.qa.yml` - serviço: `kodus-orchestrator`
- ✅ `package.json` - nome do projeto: `kodus-orchestrator`
- ✅ `apps/api/` - pasta real do código

---

## ❌ Inconsistências Encontradas

### 1. `docker-compose.dev.monorepo.yml`

**Problema**: Usa `api-rest` em vez de `kodus-orchestrator`

```yaml
# ❌ ERRADO
api-rest:
    container_name: kodus-api-rest-dev
    image: kodus-api-rest-dev
    dockerfile: DockerFiles/Dockerfile.api-rest.dev
```

**Deveria ser**:

```yaml
# ✅ CORRETO
kodus-orchestrator:
    container_name: kodus-orchestrator-dev
    image: kodus-orchestrator-dev
    dockerfile: DockerFiles/Dockerfile.orchestrator.dev
```

---

### 2. `DockerFiles/Dockerfile.api-rest.dev`

**Problema**: Referencia `apps/api-rest` que **não existe**!

```dockerfile
# ❌ ERRADO - pasta não existe!
COPY apps/api-rest ./apps/api-rest
RUN cd apps/api-rest && yarn nest build
CMD ["node", "apps/api-rest/dist/main.js"]
```

**Pasta real**: `apps/api/` ✅

**Deveria ser**:

```dockerfile
# ✅ CORRETO
COPY apps/api ./apps/api
RUN cd apps/api && yarn nest build
CMD ["node", "apps/api/dist/main.js"]
```

---

### 3. `package.json` - Scripts

**Problema**: Scripts usam `api-rest` em vez de `kodus-orchestrator`

```json
// ❌ ERRADO
"docker:build:api-rest": "...",
"docker:up:api-rest": "...",
"docker:start:api-rest": "..."
```

**Deveria ser**:

```json
// ✅ CORRETO
"docker:build:orchestrator": "...",
"docker:up:orchestrator": "...",
"docker:start:orchestrator": "..."
```

---

### 4. Documentação

**Problema**: Múltiplos docs usam `api-rest` em vez de `kodus-orchestrator`

**Arquivos afetados**:

- `docs/FORMAS-DE-RODAR-APLICACAO.md`
- `docs/POR-QUE-2-FORMAS.md`
- `docs/PROBLEMA-INCONSISTENCIA-DEV-PROD.md`
- `docs/MONOLITHIC-MODULAR-ARCHITECTURE.md`
- E muitos outros...

---

## 📋 Resumo das Inconsistências

| Local                             | Nome Usado (ERRADO)  | Nome Correto         | Status |
| --------------------------------- | -------------------- | -------------------- | ------ |
| `docker-compose.dev.monorepo.yml` | `api-rest`           | `kodus-orchestrator` | ❌     |
| `Dockerfile.api-rest.dev`         | `apps/api-rest`      | `apps/api`           | ❌     |
| `package.json` scripts            | `api-rest`           | `kodus-orchestrator` | ❌     |
| Documentação                      | `api-rest`           | `kodus-orchestrator` | ❌     |
| `ecosystem.config.js`             | `kodus-orchestrator` | `kodus-orchestrator` | ✅     |
| `docker-compose.prod.yml`         | `kodus-orchestrator` | `kodus-orchestrator` | ✅     |
| `docker-compose.qa.yml`           | `kodus-orchestrator` | `kodus-orchestrator` | ✅     |
| Pasta real                        | `apps/api/`          | `apps/api/`          | ✅     |

---

## 🎯 Padrão a Seguir

### Nome do Componente

- **Processo PM2**: `kodus-orchestrator`
- **Serviço Docker**: `kodus-orchestrator`
- **Container**: `kodus-orchestrator-dev` (dev) / `kodus-orchestrator` (prod)
- **Pasta**: `apps/api/`

### Nomenclatura Consistente

```
kodus-orchestrator (nome do componente)
├── apps/api/ (pasta do código)
├── ecosystem.config.js: name: 'kodus-orchestrator'
├── docker-compose: kodus-orchestrator:
└── Dockerfile: Dockerfile.orchestrator.dev
```

---

## 🔧 Correções Necessárias

### Prioridade Alta

1. ✅ **Renomear `Dockerfile.api-rest.dev`** → `Dockerfile.orchestrator.dev`
2. ✅ **Corrigir referências** de `apps/api-rest` → `apps/api`
3. ✅ **Atualizar `docker-compose.dev.monorepo.yml`**:
    - `api-rest` → `kodus-orchestrator`
    - `kodus-api-rest-dev` → `kodus-orchestrator-dev`
    - `Dockerfile.api-rest.dev` → `Dockerfile.orchestrator.dev`

### Prioridade Média

4. ✅ **Atualizar scripts no `package.json`**:
    - `docker:build:api-rest` → `docker:build:orchestrator`
    - `docker:up:api-rest` → `docker:up:orchestrator`
    - `docker:start:api-rest` → `docker:start:orchestrator`

### Prioridade Baixa

5. ✅ **Atualizar documentação** (gradualmente)
    - Substituir `api-rest` por `kodus-orchestrator` onde fizer sentido
    - Manter contexto histórico onde necessário

---

## 📝 Nota Importante

**Não confundir**:

- `kodus-orchestrator` = **Nome do componente/processo**
- `apps/api/` = **Pasta onde está o código**
- `ApiModule` = **Módulo NestJS**

São coisas diferentes, mas relacionados:

- O processo `kodus-orchestrator` roda o código de `apps/api/`
- O código de `apps/api/` usa o `ApiModule`

---

**Próximo passo**: Corrigir as inconsistências seguindo o padrão de produção.
