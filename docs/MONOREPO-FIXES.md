# Fixes: Monorepo - Problemas Encontrados

## 🔍 Problemas Identificados

### 1. ❌ `nest-cli.json` Ainda Existem nos Apps Antigos

**Encontrados**:

- `apps/api/nest-cli.json` ❌
- `apps/webhooks/nest-cli.json` ❌

**Problema**: Esses são apps antigos que não estão configurados no monorepo.

**Solução**: Deletar esses arquivos (ou os apps inteiros se não forem usados).

---

### 2. ⚠️ Estrutura de Apps Inconsistente

**No `nest-cli.json` da raiz**:

- `webhook-handler` → `apps/webhook-handler`
- `api-rest` → `apps/api-rest`
- `worker` → `apps/worker`

**Na estrutura real**:

- `apps/api/` (antigo?)
- `apps/webhooks/` (antigo?)
- `apps/worker/` ✅

**Problema**: `apps/webhook-handler` e `apps/api-rest` não existem!

**Solução**: Verificar se esses apps existem ou ajustar `nest-cli.json`.

---

### 3. ❓ Pacotes de Monorepo

**Atual**: Nenhum pacote de monorepo instalado (Nx, Turborepo, Lerna).

**Análise**:

- ✅ **NestJS já tem suporte nativo a monorepo** (não precisa de pacotes extras)
- ⚠️ **Opcional**: Poderia usar Nx ou Turborepo para:
    - Build paralelo
    - Cache de builds
    - Dependências entre projetos
    - Mas **não é necessário** para funcionar

**Recomendação**: Manter como está (NestJS nativo é suficiente).

---

## 🎯 Ações Necessárias

### 1. Remover `nest-cli.json` dos Apps Antigos

```bash
# Deletar nest-cli.json dos apps antigos
rm apps/api/nest-cli.json
rm apps/webhooks/nest-cli.json
```

---

### 2. Verificar Estrutura de Apps

**Opção A**: Se `apps/webhook-handler` e `apps/api-rest` existem:

- ✅ Manter `nest-cli.json` como está

**Opção B**: Se não existem e `apps/api` e `apps/webhooks` são os corretos:

- ⚠️ Ajustar `nest-cli.json` para:
    - `api` → `apps/api`
    - `webhooks` → `apps/webhooks`
    - `worker` → `apps/worker`

**Opção C**: Se `apps/api` e `apps/webhooks` são antigos e não usados:

- ❌ Deletar esses apps
- ✅ Criar `apps/webhook-handler` e `apps/api-rest`

---

### 3. Verificar Nomes dos Projetos

**No `nest-cli.json`**:

- `webhook-handler` ✅
- `api-rest` ✅
- `worker` ✅

**Verificar se correspondem aos diretórios reais**.

---

## 📋 Checklist de Fixes

- [ ] Verificar se `apps/webhook-handler` existe
- [ ] Verificar se `apps/api-rest` existe
- [ ] Verificar se `apps/api` é usado ou antigo
- [ ] Verificar se `apps/webhooks` é usado ou antigo
- [ ] Remover `nest-cli.json` dos apps antigos
- [ ] Ajustar `nest-cli.json` se necessário
- [ ] Testar build: `yarn build:webhook-handler`
- [ ] Testar build: `yarn build:api-rest`
- [ ] Testar build: `yarn build:worker`

---

## 💡 Recomendação

**Para Monorepo NestJS Nativo**:

✅ **Não precisa de pacotes extras** (Nx, Turborepo, etc.)

- NestJS já tem suporte nativo
- Funciona bem para projetos médios

⚠️ **Considerar Nx/Turborepo apenas se**:

- Projeto crescer muito (> 10 apps)
- Precisar de build paralelo otimizado
- Precisar de cache de builds
- Precisar de dependências complexas entre projetos

---

## 🎯 Próximos Passos

1. Verificar estrutura real de `apps/`
2. Remover `nest-cli.json` dos apps antigos
3. Ajustar `nest-cli.json` se necessário
4. Testar builds
