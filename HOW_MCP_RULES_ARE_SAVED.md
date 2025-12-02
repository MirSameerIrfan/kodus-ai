# Como Regras com MCP são Salvas no Banco

## Exemplo de Regra

Quando você escreve uma regra assim:

```
fileDiff analisa para mim usando o @mcp<kodus|kodus_get_diff_for_file>
```

## O que é salvo no Banco de Dados

### 1. Na Collection `kodyRules` (campo `rule`)

O texto completo é salvo literalmente no campo `rule`:

```json
{
    "uuid": "abc-123-def",
    "title": "Analyze file diff using MCP",
    "rule": "fileDiff analisa para mim usando o @mcp<kodus|kodus_get_diff_for_file>",
    "severity": "High",
    "scope": "file",
    "contextReferenceId": "ctx-ref-456-789" // ← ID da referência criada
    // ... outros campos
}
```

**Importante:**

- O texto `fileDiff` fica como está (variável de contexto)
- O texto `@mcp<kodus|kodus_get_diff_for_file>` também fica como está (marcador MCP)
- Nada é substituído ou removido do texto original

### 2. Detecção Automática de MCP

O sistema detecta automaticamente o padrão `@mcp<provider|tool>` usando regex:

```javascript
/@mcp<([^|>]+)\|([^>]+)>/g;
```

**Extraído:**

- Provider: `kodus`
- Tool: `kodus_get_diff_for_file`
- Marker completo: `@mcp<kodus|kodus_get_diff_for_file>`

### 3. Criação de ContextRequirement

O sistema cria um registro na collection `contextReferences`:

```json
{
    "uuid": "ctx-ref-456-789",
    "entityType": "kodyRule",
    "entityId": "abc-123-def",
    "requirements": [
        {
            "dependencies": [
                {
                    "type": "mcp",
                    "id": "kodus|kodus_get_diff_for_file",
                    "metadata": {
                        "provider": "kodus",
                        "tool": "kodus_get_diff_for_file",
                        "marker": "@mcp<kodus|kodus_get_diff_for_file>",
                        "originalText": "@mcp<kodus|kodus_get_diff_for_file>",
                        "repositoryId": "repo-123",
                        "detectedAt": "2024-01-15T10:30:00.000Z"
                    }
                }
            ]
        }
    ],
    "status": "active"
}
```

### 4. Associação na Regra

O campo `contextReferenceId` na regra aponta para o `ContextRequirement`:

```json
{
    "uuid": "abc-123-def",
    "rule": "fileDiff analisa para mim usando o @mcp<kodus|kodus_get_diff_for_file>",
    "contextReferenceId": "ctx-ref-456-789" // ← Link para ContextRequirement
    // ...
}
```

## Fluxo Completo

```
1. Usuário cria regra:
   "fileDiff analisa para mim usando o @mcp<kodus|kodus_get_diff_for_file>"

2. Sistema salva texto completo no campo `rule`

3. Sistema detecta MCP usando regex:
   - Encontra: @mcp<kodus|kodus_get_diff_for_file>
   - Extrai: provider="kodus", tool="kodus_get_diff_for_file"

4. Sistema cria ContextRequirement:
   - Gera UUID: ctx-ref-456-789
   - Cria dependência MCP com metadata

5. Sistema associa à regra:
   - Salva contextReferenceId: "ctx-ref-456-789"

6. Durante análise:
   - Sistema lê contextReferenceId
   - Busca ContextRequirement
   - Extrai dependências MCP
   - Executa ferramentas MCP necessárias
```

## Exemplo Completo no Banco

### Documento na Collection `kodyRules`:

```json
{
    "_id": "abc-123-def",
    "organizationId": "org-123",
    "rules": [
        {
            "uuid": "rule-456",
            "title": "Analyze file diff using MCP",
            "rule": "fileDiff analisa para mim usando o @mcp<kodus|kodus_get_diff_for_file>",
            "severity": "High",
            "scope": "file",
            "status": "active",
            "contextReferenceId": "ctx-ref-456-789",
            "examples": [],
            "language": "",
            "buckets": ["pr-hygiene"],
            "createdAt": "2024-01-15T10:30:00.000Z",
            "updatedAt": "2024-01-15T10:30:00.000Z"
        }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Documento na Collection `contextReferences`:

```json
{
    "_id": "ctx-ref-456-789",
    "entityType": "kodyRule",
    "entityId": "rule-456",
    "organizationId": "org-123",
    "repositoryId": "repo-123",
    "requirements": [
        {
            "dependencies": [
                {
                    "type": "mcp",
                    "id": "kodus|kodus_get_diff_for_file",
                    "metadata": {
                        "provider": "kodus",
                        "tool": "kodus_get_diff_for_file",
                        "marker": "@mcp<kodus|kodus_get_diff_for_file>",
                        "originalText": "@mcp<kodus|kodus_get_diff_for_file>",
                        "repositoryId": "repo-123",
                        "detectedAt": "2024-01-15T10:30:00.000Z"
                    }
                }
            ]
        }
    ],
    "status": "active",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

## Variáveis de Contexto vs MCP Tools

### Variáveis de Contexto (como `fileDiff`)

- **Não são detectadas** como dependências
- **Ficam no texto literal** da regra
- **São resolvidas em runtime** durante a análise
- **Não geram ContextRequirement**

### MCP Tools (como `@mcp<kodus|kodus_get_diff_for_file>`)

- **São detectadas automaticamente** pelo regex
- **Ficam no texto literal** da regra (preservadas)
- **Geram ContextRequirement** com dependências
- **São executadas durante análise** via ContextEvidenceAgent

## Múltiplos MCPs na Mesma Regra

Se você tiver:

```
Analisa fileDiff usando @mcp<kodus|kodus_get_diff_for_file> e busca issues no @mcp<sentry|search_issues>
```

O sistema cria **uma única ContextRequirement** com **múltiplas dependências**:

```json
{
    "requirements": [
        {
            "dependencies": [
                {
                    "type": "mcp",
                    "id": "kodus|kodus_get_diff_for_file",
                    "metadata": {
                        "provider": "kodus",
                        "tool": "kodus_get_diff_for_file"
                    }
                },
                {
                    "type": "mcp",
                    "id": "sentry|search_issues",
                    "metadata": {
                        "provider": "sentry",
                        "tool": "search_issues"
                    }
                }
            ]
        }
    ]
}
```

## Resumo

✅ **Texto da regra:** Salvo literalmente, incluindo variáveis e marcadores MCP  
✅ **MCP Tools:** Detectados automaticamente e extraídos  
✅ **ContextRequirement:** Criado com dependências MCP  
✅ **Associação:** `contextReferenceId` linka regra → ContextRequirement  
✅ **Runtime:** Durante análise, sistema busca ContextRequirement e executa MCPs
