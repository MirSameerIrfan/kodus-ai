# Skills (Context-OS Lab)

Este diretório descreve como modelar “skills” no estilo Claude usando o nosso
Context‑OS.

## Interfaces

`interfaces.ts` define o contrato base:

- `SkillDefinition` – metadados + blocos de instrução + ações/recursos.
- `SkillInstructionBlock` – equivalente a um override (`role`, `scope`, texto).
- `SkillAction` / `SkillResource` – amarram MCP/workflows e anexos necessários.
- `SkillSet` – arquivo versionado com várias skills.

Essas interfaces aceitam conversão direta para YAML/JSON. Exemplo YAML:

```yaml
version: "2025.01"
skills:
  - id: "checklist-testes"
    metadata:
      title: "Gerar checklist de testes"
      description: "Sugere testes obrigatórios antes de aprovar o PR."
      version: "1.0.0"
      domain: "code"
      tags: ["review", "quality"]
    instructions:
      - id: "system"
        role: "system"
        scope: "core"
        content: >
          Sempre produza um checklist com itens verificáveis...
    requiredTools:
      - mcpId: "bugspec"
        toolName: "fetch-bugspec"
    requiredActions:
      - description: "Carregar BugSpec antes da análise"
        action:
          id: "load-bugspec"
          type: "mcp"
          trigger: "pre_core"
          mcpId: "bugspec"
          toolName: "fetch-bugspec"
```

## Fluxo sugerido

1. Salvar as skills em YAML/JSON versionado (`skills/code-review.yml`).
2. Usar `loader.ts` (`loadSkillsFromDirectory`) para converter o YAML/JSON em
   `SkillSet`.
3. O `InMemorySkillRegistry` (`registry.ts`) mantém as skills ativas e fornece
   acesso rápido (`get`/`list`).
4. Durante a montagem do pack, o bundle injeta as instruções e ações das skills
   selecionadas de acordo com o intent ou seleção humana.

Exemplo rápido:

```ts
import { loadSkillsFromDirectory } from './loader.js';

const registry = await loadSkillsFromDirectory('context-engineering/skills/examples');
const checklist = registry.get('checklist-testes');
```

Como estamos em laboratório, você pode manter o loader local e, em produção,
persistir as skills em banco/feature flags reaproveitando as interfaces.
