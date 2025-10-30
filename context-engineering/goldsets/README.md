# Gold Sets para regressão

Estrutura mínima para validar packs gerados pelo Context-OS.

## Estrutura

```json
{
  "domain": "code",
  "intent": "review",
  "version": "2025.10-lab",
  "cases": [
    {
      "id": "cr-001",
      "pullRequest": { "number": 42, "files": ["src/payment.ts"] },
      "expectedFindings": [
        { "description": "Mencionar regra XYZ", "severity": "high" }
      ],
      "requiredSkills": ["checklist-testes"],
      "knowledgeItems": ["rule-xyz"]
    }
  ]
}
```

- `expectedFindings` serve como baseline para comparar saídas do agente.
- `requiredSkills` indica quais skills devem ser ativadas no bundle.
- `knowledgeItems` lista itens do fabric que precisam estar disponíveis.

## Próximos passos

1. Criar script que roda o bundle contra cada `case` e serializa o resultado.
2. Diferenças relevantes viram regressões; os eventos `ACTION_*` ajudam a
   detectar gaps (ex.: ação falhou => caso inválido).
