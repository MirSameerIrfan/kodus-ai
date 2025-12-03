# Monorepo vs Multirepo: Estrutura Atual

## 🎯 Resposta Direta

**NÃO são 3 projetos separados.**

É **1 projeto único (monorepo)** com **3 entry points** diferentes.

---

## 📦 Estrutura Atual: Monorepo

### O Que Você Tem Agora

```
kodus-ai/                          ← 1 PROJETO ÚNICO
├── package.json                    ← 1 package.json
├── tsconfig.json                   ← 1 tsconfig.json
├── yarn.lock                       ← 1 yarn.lock
│
├── src/
│   ├── main.ts                    ← Entry Point 1: API REST
│   ├── webhook-handler.ts         ← Entry Point 2: Webhook Handler
│   ├── worker.ts                  ← Entry Point 3: Worker
│   │
│   ├── modules/
│   │   ├── app.module.ts          ← Módulo base compartilhado
│   │   ├── api.module.ts          ← Módulo API REST
│   │   ├── webhook-handler.module.ts ← Módulo Webhook Handler
│   │   └── worker.module.ts       ← Módulo Worker
│   │
│   └── core/                       ← Código compartilhado
│       ├── domain/
│       ├── application/
│       └── infrastructure/
│
└── ecosystem.config.js            ← PM2 gerencia 3 processos
```

### Características

- ✅ **1 repositório Git**
- ✅ **1 package.json**
- ✅ **1 build** (`yarn build`)
- ✅ **Código compartilhado** (core/, shared/)
- ✅ **3 entry points** diferentes
- ✅ **3 processos PM2** separados

---

## 🔄 Como Funciona

### Build

```bash
# 1 build único gera todos os entry points
yarn build

# Resultado:
dist/
├── src/
│   ├── main.js              ← API REST
│   ├── webhook-handler.js   ← Webhook Handler
│   └── worker.js            ← Worker
```

### PM2 (3 Processos do Mesmo Build)

```javascript
// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'webhook-handler',
            script: './dist/src/webhook-handler.js',  // ← Mesmo build
            // ...
        },
        {
            name: 'kodus-orchestrator',
            script: './dist/src/main.js',              // ← Mesmo build
            // ...
        },
        {
            name: 'workflow-worker',
            script: './dist/src/worker.js',            // ← Mesmo build
            // ...
        },
    ],
};
```

### Código Compartilhado

```typescript
// Todos os 3 entry points usam o mesmo código compartilhado

// src/core/domain/workflowQueue/...
// src/core/application/use-cases/...
// src/core/infrastructure/...

// webhook-handler.ts usa:
import { EnqueueCodeReviewJobUseCase } from '@/core/application/use-cases/workflowQueue/...';

// worker.ts usa:
import { ProcessWorkflowJobUseCase } from '@/core/application/use-cases/workflowQueue/...';

// main.ts usa:
import { GetJobStatusUseCase } from '@/core/application/use-cases/workflowQueue/...';
```

---

## ❌ O Que NÃO É: Multirepo (3 Projetos Separados)

### Se Fosse Multirepo (NÃO é o caso)

```
projeto-webhook-handler/           ← Projeto 1
├── package.json
├── src/
│   └── main.ts
└── node_modules/

projeto-api-rest/                  ← Projeto 2
├── package.json
├── src/
│   └── main.ts
└── node_modules/

projeto-worker/                    ← Projeto 3
├── package.json
├── src/
│   └── main.ts
└── node_modules/
```

**Problemas**:
- ❌ 3 repositórios Git separados
- ❌ 3 package.json separados
- ❌ 3 builds separados
- ❌ Código duplicado ou precisa de packages npm
- ❌ Sincronização de versões complexa

---

## ✅ Vantagens do Monorepo (Estrutura Atual)

### 1. Código Compartilhado

```
✅ Todos usam o mesmo código:
   • Domain layer
   • Application layer
   • Infrastructure layer
   • Shared utilities
```

### 2. Build Único

```
✅ 1 build gera tudo:
   yarn build
   → dist/src/main.js
   → dist/src/webhook-handler.js
   → dist/src/worker.js
```

### 3. Dependências Compartilhadas

```
✅ 1 node_modules:
   • Todas as dependências em um lugar
   • Sem duplicação
   • Versões sincronizadas
```

### 4. Deploy Simples

```
✅ 1 build, 3 processos:
   • Build uma vez
   • PM2 inicia 3 processos do mesmo build
   • Cada processo carrega módulo diferente
```

### 5. Manutenção Fácil

```
✅ Mudanças compartilhadas:
   • Mudança no domain → afeta todos automaticamente
   • Mudança no shared → afeta todos automaticamente
   • Sem precisar atualizar múltiplos projetos
```

---

## 🔍 Comparação Visual

### Monorepo (Atual) ✅

```
┌─────────────────────────────────────────┐
│         kodus-ai (1 projeto)             │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Build: yarn build                │ │
│  │  → dist/src/main.js               │ │
│  │  → dist/src/webhook-handler.js    │ │
│  │  → dist/src/worker.js            │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  PM2: 3 processos                  │ │
│  │  • webhook-handler (main.js)      │ │
│  │  • api-rest (webhook-handler.js)  │ │
│  │  • worker (worker.js)              │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ✅ Código compartilhado                │
│  ✅ 1 package.json                      │
│  ✅ 1 repositório Git                   │
└─────────────────────────────────────────┘
```

### Multirepo (NÃO é) ❌

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ projeto-1    │  │ projeto-2    │  │ projeto-3    │
│              │  │              │  │              │
│ package.json │  │ package.json │  │ package.json │
│ src/main.ts  │  │ src/main.ts  │  │ src/main.ts  │
│              │  │              │  │              │
│ ❌ Código     │  │ ❌ Código     │  │ ❌ Código     │
│    duplicado  │  │    duplicado  │  │    duplicado  │
│ ❌ 3 builds   │  │ ❌ 3 builds   │  │ ❌ 3 builds   │
│ ❌ 3 repos    │  │ ❌ 3 repos    │  │ ❌ 3 repos    │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 📊 Resumo: Monorepo vs Multirepo

| Aspecto | Monorepo (Atual) | Multirepo |
|---------|------------------|-----------|
| **Repositórios** | 1 | 3 |
| **package.json** | 1 | 3 |
| **Build** | 1 build | 3 builds |
| **Código Compartilhado** | ✅ Sim (mesmo repo) | ❌ Não (precisa packages) |
| **Deploy** | Simples (1 build) | Complexo (3 builds) |
| **Manutenção** | Fácil (mudanças compartilhadas) | Difícil (sincronizar versões) |
| **Entry Points** | 3 (mesmo projeto) | 3 (projetos separados) |

---

## 🎯 Resposta Final

### Você Tem:

**1 projeto (monorepo)** com **3 entry points** diferentes.

**NÃO são 3 projetos separados.**

**São 3 processos PM2** rodando **3 entry points diferentes** do **mesmo build**.

---

## 💡 Analogia

Pense como um **restaurante**:

- **Monorepo**: 1 restaurante com 3 portas de entrada diferentes
  - Porta 1: Entrada principal (API REST)
  - Porta 2: Entrada delivery (Webhook Handler)
  - Porta 3: Cozinha (Worker)
  - ✅ Mesma cozinha (código compartilhado)
  - ✅ Mesmos ingredientes (dependências)

- **Multirepo**: 3 restaurantes separados
  - ❌ Cada um com sua própria cozinha
  - ❌ Cada um com seus próprios ingredientes
  - ❌ Difícil manter consistência

---

## ✅ Conclusão

**Estrutura Atual**: ✅ **Monorepo** (1 projeto, 3 entry points)

**Vantagens**:
- ✅ Código compartilhado
- ✅ Build único
- ✅ Manutenção fácil
- ✅ Deploy simples

**Não é**: ❌ Multirepo (3 projetos separados)

