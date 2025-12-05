# 🔍 Análise: Estrutura do Monorepo

**Data**: 2025-01-27  
**Questão**: A estrutura atual (`apps/`, `src/`, `packages/`) faz sentido?

---

## 📁 Estrutura Atual

```
kodus-ai/
├── apps/                    # Aplicações (entry points)
│   ├── api/                # kodus-orchestrator
│   ├── webhooks/           # webhook-handler
│   └── worker/             # workflow-worker
│
├── src/                    # Código compartilhado (solto na raiz)
│   ├── core/              # Domain, Application, Infrastructure
│   ├── modules/           # Módulos NestJS
│   ├── shared/            # Utilitários compartilhados
│   ├── config/            # Configurações
│   ├── main.ts            # Entry point legado?
│   ├── webhook-handler.ts # Entry point legado?
│   └── worker.ts          # Entry point legado?
│
└── packages/              # Pacotes compartilhados (publicáveis)
    ├── kodus-flow/        # Framework de agentes
    └── kodus-common/      # Utilitários comuns
```

---

## ❓ Problemas Identificados

### 1. `src/` Solto na Raiz

**Problema**: 
- `src/` está na raiz, mas também há `apps/` na raiz
- `src/main.ts`, `src/webhook-handler.ts`, `src/worker.ts` parecem ser entry points legados
- `apps/api/src/main.ts` é o entry point novo
- **Duplicação de entry points?**

**Pergunta**: Por que existem entry points em `src/` E em `apps/`?

---

### 2. `packages/` vs `src/`

**Diferença**:
- `packages/` = Pacotes publicáveis (têm `package.json` próprio)
- `src/` = Código compartilhado interno (não publicável)

**Problema**:
- Ambos são código compartilhado
- Diferença não é clara para desenvolvedores
- Quando usar `packages/` vs `src/shared/`?

---

### 3. `src/shared/` vs `packages/`

**Problema**:
- `src/shared/` = Utilitários compartilhados internos
- `packages/kodus-common/` = Utilitários compartilhados (publicáveis)
- **Qual a diferença prática?**

---

### 4. Entry Points Duplicados

**Problema**:
- `src/main.ts` vs `apps/api/src/main.ts`
- `src/webhook-handler.ts` vs `apps/webhooks/src/main.ts`
- `src/worker.ts` vs `apps/worker/src/main.ts`

**Pergunta**: Qual está sendo usado? Por que existem dois?

---

## 🎯 Padrões de Monorepo

### Padrão 1: NestJS Monorepo (Atual)

```
apps/
  └── api/
      └── src/
          └── main.ts

src/              # Código compartilhado
  └── core/
```

**Características**:
- ✅ Suportado nativamente pelo NestJS
- ✅ `nest-cli.json` gerencia projetos
- ⚠️ `src/` na raiz pode confundir

---

### Padrão 2: Nx Monorepo

```
apps/
  └── api/
      └── src/
          └── main.ts

libs/             # Bibliotecas compartilhadas
  └── core/
```

**Características**:
- ✅ Separação clara: `apps/` vs `libs/`
- ✅ Ferramentas poderosas (build cache, etc)
- ❌ Overhead de configuração

---

### Padrão 3: Turborepo

```
apps/
  └── api/
      └── src/
          └── main.ts

packages/         # Pacotes compartilhados
  └── core/
```

**Características**:
- ✅ Simples e direto
- ✅ Build cache eficiente
- ✅ Boa para monorepos TypeScript

---

### Padrão 4: Lerna/Yarn Workspaces

```
packages/
  ├── api/        # App
  ├── webhooks/   # App
  └── core/       # Biblioteca compartilhada
```

**Características**:
- ✅ Tudo em `packages/`
- ✅ Simples
- ⚠️ Menos estruturação

---

## 🤔 Análise da Estrutura Atual

### O Que Faz Sentido

✅ **`apps/` separado** - Entry points claros
✅ **`packages/` para pacotes publicáveis** - Separação clara
✅ **NestJS monorepo** - Suportado nativamente

### O Que Não Faz Sentido

❌ **`src/` solto na raiz** - Confunde com `apps/`
❌ **Entry points duplicados** - `src/main.ts` vs `apps/api/src/main.ts`
❌ **`src/shared/` vs `packages/`** - Diferença não clara
❌ **Mistura de padrões** - Não segue um padrão estabelecido claramente

---

## 💡 Recomendações

### Opção 1: Manter NestJS Monorepo, Limpar Estrutura

```
apps/
  ├── api/
  ├── webhooks/
  └── worker/

libs/              # Renomear src/ para libs/
  ├── core/        # Domain, Application, Infrastructure
  ├── modules/     # Módulos NestJS compartilhados
  └── shared/      # Utilitários compartilhados

packages/          # Pacotes publicáveis
  ├── kodus-flow/
  └── kodus-common/
```

**Mudanças**:
- ✅ Renomear `src/` → `libs/` (mais claro)
- ✅ Remover entry points duplicados de `src/`
- ✅ Manter apenas `apps/*/src/main.ts`

---

### Opção 2: Seguir Padrão Turborepo

```
apps/
  ├── api/
  ├── webhooks/
  └── worker/

packages/
  ├── core/        # Mover src/core para packages/core
  ├── modules/     # Mover src/modules para packages/modules
  ├── shared/      # Mover src/shared para packages/shared
  ├── kodus-flow/
  └── kodus-common/
```

**Mudanças**:
- ✅ Tudo compartilhado em `packages/`
- ✅ Estrutura mais simples
- ✅ Padrão estabelecido

---

### Opção 3: Manter Como Está, Mas Limpar

```
apps/
  ├── api/
  ├── webhooks/
  └── worker/

src/               # Manter, mas limpar
  ├── core/        # Código compartilhado interno
  ├── modules/     # Módulos NestJS
  └── shared/      # Utilitários internos

packages/          # Pacotes publicáveis
  ├── kodus-flow/
  └── kodus-common/
```

**Mudanças**:
- ✅ Remover entry points duplicados de `src/`
- ✅ Documentar diferença: `src/` = interno, `packages/` = publicável
- ✅ Manter estrutura atual (menos mudanças)

---

## 🎯 Perguntas para Decidir

1. **Por que existem entry points em `src/`?**
   - São legados?
   - Ainda são usados?
   - Podem ser removidos?

2. **Qual a diferença entre `src/shared/` e `packages/kodus-common/`?**
   - Quando usar cada um?
   - Podem ser consolidados?

3. **`src/` deve ser renomeado para `libs/`?**
   - Mais claro?
   - Segue padrões?

4. **Quer seguir um padrão estabelecido (Nx, Turborepo)?**
   - Ou manter customizado?

---

## 📝 Recomendação Final

**Opção 3 (Manter, mas limpar)** parece mais pragmática:

1. ✅ **Remover entry points duplicados** de `src/`
2. ✅ **Documentar diferença** entre `src/` e `packages/`
3. ✅ **Manter estrutura atual** (menos breaking changes)
4. ✅ **Considerar renomear** `src/` → `libs/` no futuro (se fizer sentido)

**Por quê**:
- Menos mudanças disruptivas
- Mantém compatibilidade
- Limpa confusões principais
- Pode evoluir depois

---

**Próximo passo**: Entender se os entry points em `src/` ainda são usados ou são legados.

