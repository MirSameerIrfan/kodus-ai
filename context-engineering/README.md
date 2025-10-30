# Context Engineering Lab

Este diretório é o laboratório onde modelamos o **Knowledge Fabric** antes de
embarcar qualquer mudança no runtime. A ideia é manter tudo versionado aqui:

- **Snapshots/Bundles** de domínio (code review, suporte, etc.)
- **Knowledge Items** persistidos (memórias corporativas, regras, checklists)
- **Pipelines de ingestão** (normalizadores, conectores fake/protótipo)
- **Selectors/Materializers** que consomem o fabric persistente

> Nada aqui roda em produção diretamente; usamos como blueprint para depois
> portar o design para os pacotes oficiais (`context-os-core`, `kodus-flow`).

## Mínimo viável agora

1. Persistir `KnowledgeItem` em disco (arquivo JSON) para simular a memória
   corporativa.
2. Ingestores simples (`ingest-rule.ts`) que registram novas regras.
3. Selector que lê do store e injeta no catálogo/ativa do pack de code review.
4. Bundle de exemplo demonstrando como a regra “XYZ” entra no fluxo sem tocar
   nos prompts de execução.

Os arquivos relevantes ficam em:

```
context-engineering/
  knowledge-fabric/
    store.ts          # armazenamento persistente (JSON, versionável)
    ingest-rule.ts    # exemplo de ingestão manual de regra corporativa
    selector.ts       # selector que consulta o store
  bundles/
    code-review/
      snapshot.json   # snapshot atual do domínio
      bundle.ts       # protótipo de bundle usando o fabric persistente
```

Nas próximas seções detalhamos cada peça.

## Como adicionar uma nova regra (“Regra Xyz”)

1. Escreva o conteúdo em `knowledge-fabric/knowledge/rules/<nome>.md`.
2. Rode o ingestor para persistir no store (JSON):

   ```bash
   cd context-engineering/knowledge-fabric
   node --loader ts-node/esm ingest-rule.ts knowledge/rules/xyz.md
   ```

   Isso gera/atualiza `store.json` com o `KnowledgeItem`.

3. Execute o bundle de laboratório para confirmar que a regra aparece no pack:

   ```bash
   cd context-engineering/bundles/code-review
   node --loader ts-node/esm bundle.ts
   ```

   No console você verá `Regras injetadas: ['rule-xyz']`, provando que o
   selector carregou a memória persistida em disco.

Quando migrarmos para produção basta trocar `store.ts` por um back-end real
(Mongo/Postgres + índices) e reaproveitar os mesmos ingestores/selectors.
