# Variáveis de Contexto para Kody Rules

## Variáveis disponíveis por Scope

### 🔵 Scope: `pull-request`

Variáveis disponíveis para análise de Pull Requests:

- **`pr_title`** - Título do Pull Request
- **`pr_description`** - Descrição completa do Pull Request
- **`pr_total_additions`** - Total de linhas adicionadas no PR
- **`pr_total_deletions`** - Total de linhas removidas no PR
- **`pr_total_files`** - Total de arquivos modificados no PR
- **`pr_total_lines_changed`** - Total de linhas alteradas (additions + deletions)
- **`pr_files_diff`** - Diff completo de todos os arquivos do PR
- **`pr_tags`** - Array de tags do PR (ex: ["bug", "feature", "security"])
- **`pr_author`** - Autor do Pull Request
- **`pr_number`** - Número do Pull Request

### 🟢 Scope: `file`

Variáveis disponíveis para análise de arquivos individuais:

- **`fileDiff`** - Diff do arquivo sendo analisado (mostra linhas adicionadas `+` e removidas `-`)

## Como usar nas regras

### Exemplo com variáveis de contexto PR:

```json
{
    "rule": "Check the `pr_title` and `pr_description` context variables to analyze the PR content. If `pr_tags` contains 'bug', verify Sentry issue reference."
}
```

### Exemplo com variáveis de contexto File:

```json
{
    "rule": "Analyze the `fileDiff` to identify new API routes. Use KODUS_GET_REPOSITORY_FILES to locate route documentation files."
}
```

### Combinando variáveis de contexto com MCP:

```json
{
    "rule": "If `pr_tags` contains 'bug', use Sentry MCP tools (search_events) with error messages from `pr_description` to find related Sentry issues."
}
```

## Notas importantes

1. **Variáveis de contexto são acessadas diretamente** - Não precisam de MCP tools
2. **MCP tools são para dados externos** - Use quando precisar buscar informações de sistemas externos
3. **Combine ambos** - Use variáveis de contexto para análise local e MCP para validação externa

## Exemplos práticos

### Regra que usa apenas contexto PR:

```json
{
    "rule": "If `pr_total_files` > 10, ensure `pr_description` includes a review guide explaining the changes."
}
```

### Regra que combina contexto + MCP:

```json
{
    "rule": "Check `pr_tags` for 'bug' tag. If present, use Sentry MCP (search_events) with error keywords from `pr_description` to find related Sentry issues."
}
```

### Regra que usa contexto File:

```json
{
    "rule": "Analyze `fileDiff` to identify new API endpoints. Use KODUS_GET_REPOSITORY_CONTENT to verify they are documented in routes.json."
}
```
