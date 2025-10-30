# Estratégias de Seleção Barata de Contexto (Alternativas ao GraphRAG)

| Técnica | Descrição | Custo | Benefícios | Limitações / Quando evitar |
| --- | --- | --- | --- | --- |
| **Retrieval híbrido leve** | BM25 (lexical) + embeddings + heurísticas (peso maior para arquivos/diffs do PR) | Baixo | Simples, sem infra adicional | Menos eficiente em multi-hop profundo |
| **Heurísticas de impacto (code)** | AST, call graph, dependências diretas (ex.: usar tree-sitter para mapear funções afetadas) | Baixo/moderado |  suporte multi-hop local, não requer LLM | Precisa customização por linguagem |
| **Sumários incrementais (FIC)** | Frequent Intentional Compaction: manter spec/progress com resumos controlados | Muito baixo | Melhor controle de orçamento, evita drift | Depende de disciplina/processo humano |
| **Topical clusters/labels** | Catalogar docs por tags manuais/automáticas (k-means, TF-IDF) e usar metadata na seleção | Baixo | Bom para RAG textual coeso | Pode ignorar relações implícitas |
| **FAQ/Seed corpora** | Guardar respostas curtas para perguntas frequentes (fallback) | Muito baixo | Ajuda a evitar chamadas caras no LLM | Não resolve casos inéditos complexos |
| **Graph lite (adjacency)** | Armazenar relações simples (arquivo → depende de → arquivo) em estruturas leves (JSON/SQLite) | Baixo | Permite multi-hop curto com custo reduzido | Escala limitada, sem reasoning semântico |
| **Prompt profissional** | Ajustar prompts para perguntar explicitamente “liste dependências, cite módulos X” e human review | Muito baixo | Sem infra, aproveita LLM | Depende de qualidade do modelo |

## Sugestões práticas
- Começar com BM25 + embeddings + metadata (labels/domínio) → baixo custo e implementação rápida.  
- Para código: gerar adjacency lists via tree-sitter (função → chamadas) e usar isso como heurística de seleção (sem Neo4j).  
- Aplicar Frequent Intentional Compaction para manter o contexto enxuto e evitar recomputar seleção a todo momento.  
- Construir `ContextResourceRef` para apontar recursos pesados (logs, scripts) e só carregar quando necessário.  
- Usar caching dos packs/respostas recentes para evitar repetição de pipeline (e reusar contexto).
