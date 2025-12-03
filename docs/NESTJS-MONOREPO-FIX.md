# Fix: NestJS Monorepo Configuration

## 🎯 Problema Identificado

**Estamos criando múltiplos `nest-cli.json` quando o NestJS suporta monorepo nativamente!**

**Atual**:
- ❌ `nest-cli.json` na raiz
- ❌ `apps/webhook-handler/nest-cli.json`
- ❌ `apps/api-rest/nest-cli.json`
- ❌ `apps/worker/nest-cli.json`

**Problema**: Não estamos usando a configuração nativa de monorepo do NestJS!

---

## ✅ Solução: NestJS Monorepo Nativo

### Estrutura Correta

**1 `nest-cli.json` na raiz** com configuração de monorepo:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": false
  },
  "monorepo": true,
  "root": "apps/api-rest",
  "projects": {
    "webhook-handler": {
      "type": "application",
      "root": "apps/webhook-handler",
      "entryFile": "main",
      "sourceRoot": "apps/webhook-handler/src",
      "compilerOptions": {
        "tsConfigPath": "apps/webhook-handler/tsconfig.json"
      }
    },
    "api-rest": {
      "type": "application",
      "root": "apps/api-rest",
      "entryFile": "main",
      "sourceRoot": "apps/api-rest/src",
      "compilerOptions": {
        "tsConfigPath": "apps/api-rest/tsconfig.json"
      }
    },
    "worker": {
      "type": "application",
      "root": "apps/worker",
      "entryFile": "main",
      "sourceRoot": "apps/worker/src",
      "compilerOptions": {
        "tsConfigPath": "apps/worker/tsconfig.json"
      }
    }
  }
}
```

---

## 📋 Mudanças Necessárias

### 1. Atualizar `nest-cli.json` na Raiz

**Adicionar configuração de monorepo** com `projects`.

---

### 2. Remover `nest-cli.json` dos Apps

**Deletar**:
- ❌ `apps/webhook-handler/nest-cli.json`
- ❌ `apps/api-rest/nest-cli.json`
- ❌ `apps/worker/nest-cli.json`

---

### 3. Ajustar Scripts de Build

**Atual**:
```json
"build:webhook-handler": "cd apps/webhook-handler && nest build"
```

**Novo** (usando monorepo):
```json
"build:webhook-handler": "nest build webhook-handler",
"build:api-rest": "nest build api-rest",
"build:worker": "nest build worker",
"build:apps": "nest build webhook-handler && nest build api-rest && nest build worker"
```

---

## 🎯 Vantagens do Monorepo Nativo

### 1. Configuração Centralizada

✅ **1 `nest-cli.json`** na raiz
✅ **Configurações compartilhadas** definidas uma vez
✅ **Configurações específicas** por projeto

---

### 2. Build Simplificado

**Antes**:
```bash
cd apps/webhook-handler && nest build
```

**Depois**:
```bash
nest build webhook-handler
```

---

### 3. Workspace Nativo

✅ NestJS entende que é monorepo
✅ Ferramentas funcionam corretamente
✅ IDE suporta melhor

---

## 📊 Comparação: Antes vs Depois

| Aspecto | Antes (Múltiplos nest-cli.json) | Depois (Monorepo Nativo) |
|---------|--------------------------------|--------------------------|
| **nest-cli.json** | 4 arquivos | 1 arquivo ✅ |
| **Configuração** | Duplicada | Centralizada ✅ |
| **Build** | `cd apps/... && nest build` | `nest build <project>` ✅ |
| **Manutenção** | Difícil (4 arquivos) | Fácil (1 arquivo) ✅ |
| **NestJS Support** | Não reconhece monorepo | Reconhece monorepo ✅ |

---

## 🚀 Próximos Passos

1. ✅ Atualizar `nest-cli.json` na raiz com configuração de monorepo
2. ✅ Deletar `nest-cli.json` dos apps
3. ✅ Ajustar scripts de build no `package.json`
4. ✅ Testar build: `yarn build:webhook-handler`
5. ✅ Testar build: `yarn build:apps`

---

**Quer que eu ajuste agora?**

