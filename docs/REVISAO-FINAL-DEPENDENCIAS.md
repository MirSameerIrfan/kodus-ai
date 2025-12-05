# Revisão Final de Dependências - package.json

**Data**: 2025-01-15  
**Objetivo**: Identificar pacotes que podem ser removidos após limpeza inicial

---

## 📊 Resumo

- **Total de dependências analisadas**: ~110 pacotes
- **Pacotes candidatos para remoção**: ~15 pacotes
- **Pacotes que devem mudar para devDependencies**: 2 pacotes

---

## ❌ Dependências NÃO UTILIZADAS (Remover)

### Test & Development Tools (deveriam estar em devDependencies)

1. **`@faker-js/faker`** - ❌ **NÃO ENCONTRADO** no código
   - Usado apenas em testes, mas não encontrado nenhum uso
   - **Ação**: Remover ou mover para devDependencies se necessário

### LLM Providers Não Utilizados

2. **`@langchain/cohere`** - ❌ **NÃO ENCONTRADO** no código
   - É peerDependency de `@kodus/kodus-common`, mas não está sendo usado
   - **Ação**: Verificar se realmente não é necessário antes de remover

3. **`@langchain/google-genai`** - ⚠️ **PEER DEPENDENCY** mas não encontrado em uso
   - É peerDependency de `@kodus/kodus-common`
   - **Ação**: Verificar se realmente não é necessário antes de remover

### Platform Integrations Não Utilizados

4. **`@octokit/auth-oauth-app`** - ❌ **NÃO ENCONTRADO** no código
   - Usa apenas `@octokit/auth-app`
   - **Ação**: Remover

5. **`octokit`** - ❌ **NÃO ENCONTRADO** no código
   - Usa apenas `@octokit/rest` e outros pacotes @octokit/*
   - **Ação**: Remover

6. **`azure-devops-node-api`** - ❌ **NÃO UTILIZADO**
   - AzureReposService usa axios diretamente
   - **Ação**: Remover

### Utilities Não Utilizadas

7. **`blocked-at`** - ❌ **NÃO ENCONTRADO** no código
   - Biblioteca para detectar event loop blocking
   - **Ação**: Remover

8. **`nodemailer-express-handlebars`** - ❌ **NÃO ENCONTRADO** no código
   - Usa apenas `mailersend` para emails
   - **Ação**: Remover

9. **`pg-promise`** - ❌ **NÃO ENCONTRADO** no código
   - Usa apenas `pg` (driver nativo)
   - **Ação**: Remover

10. **`whatwg-url`** - ❌ **NÃO ENCONTRADO** no código
    - Pode ser dependência transitiva
    - **Ação**: Verificar e remover se não necessário

11. **`yarn`** - ❌ **NÃO DEVERIA ESTAR EM DEPENDENCIES**
    - Package manager não deve estar em dependencies
    - **Ação**: Remover

12. **`graphql`** - ❌ **NÃO UTILIZADO DIRETAMENTE**
    - Usa apenas `@octokit/graphql` (que já inclui graphql como dependência)
    - Não há imports diretos de `graphql` no código
    - **Ação**: Remover (é dependência transitiva de @octokit/graphql)

### Observability

13. **`@sentry/cli`** - ⚠️ **USADO APENAS EM SCRIPTS**
    - Usado no script `sentry:sourcemaps`
    - **Ação**: Mover para devDependencies

---

## ⚠️ Dependências SUSPEITAS (Verificar)

### Podem ser dependências transitivas

1. **`micromatch`** - Pode ser usado por outras dependências
2. **`date-fns`** - Não encontrado uso direto, mas pode estar sendo usado
3. **`@nestjs/axios`** - Pode ser usado indiretamente pelo NestJS
4. **`@nestjs/devtools-integration`** - Pode ser usado em desenvolvimento

---

## 📦 Dependências que DEVEM estar no package.json (peerDependencies)

### Usadas por @kodus/flow
- ✅ `@google/generative-ai` - Usado em `gemini-provider.ts`
- ✅ `ajv` - Validação de schemas
- ✅ `json5` - Parser JSON5

### Usadas por @kodus/kodus-common (peerDependencies)
- ✅ `@langchain/anthropic` - Usado em `helper.ts` e `anthropicAdapter.ts`
- ✅ `@langchain/google-vertexai` - Usado em `helper.ts` e `vertexAdapter.ts`
- ⚠️ `@langchain/google-genai` - Peer dependency, verificar uso
- ⚠️ `@langchain/cohere` - Peer dependency, verificar uso
- ✅ `zod-to-json-schema` - Usado por `@kodus/flow` em `tool-engine.ts`

---

## 🔧 Recomendações de Ação

### 1. Remover Dependências Não Utilizadas

```bash
# Remover pacotes não utilizados
yarn remove @faker-js/faker @octokit/auth-oauth-app octokit azure-devops-node-api blocked-at nodemailer-express-handlebars pg-promise whatwg-url yarn graphql

# Mover para devDependencies
yarn remove @sentry/cli
yarn add -D @sentry/cli
```

### 2. Verificar Peer Dependencies

Antes de remover `@langchain/cohere` e `@langchain/google-genai`:
- Verificar se são realmente necessários para `@kodus/kodus-common`
- Se não forem usados, podem ser removidos do peerDependencies do `@kodus/kodus-common` também

### 3. Verificar Dependências Transitivas

```bash
# Verificar se são realmente necessárias
yarn why micromatch
yarn why date-fns
yarn why @nestjs/axios
yarn why @nestjs/devtools-integration
```

---

## 📝 Notas Importantes

1. **Peer Dependencies**: Algumas dependências são necessárias porque são peerDependencies dos packages internos (`@kodus/flow`, `@kodus/kodus-common`)

2. **Dependências Transitivas**: Algumas podem ser instaladas automaticamente por outras dependências

3. **Testes**: Algumas dependências podem ser usadas apenas em testes (devDependencies)

4. **Scripts**: `@sentry/cli` é usado apenas em scripts de build, deve estar em devDependencies

---

## ✅ Checklist de Remoção

- [ ] Remover `@faker-js/faker` (ou mover para devDependencies)
- [ ] Remover `@octokit/auth-oauth-app`
- [ ] Remover `octokit`
- [ ] Remover `azure-devops-node-api`
- [ ] Remover `blocked-at`
- [ ] Remover `nodemailer-express-handlebars`
- [ ] Remover `pg-promise`
- [ ] Remover `whatwg-url` (verificar primeiro)
- [ ] Remover `yarn`
- [ ] Remover `graphql`
- [ ] Mover `@sentry/cli` para devDependencies
- [ ] Verificar `@langchain/cohere` e `@langchain/google-genai` antes de remover
- [ ] Verificar dependências transitivas (`micromatch`, `date-fns`, etc.)

