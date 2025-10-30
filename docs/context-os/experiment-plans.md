# Planos de Execução – Experimentos Prioritários

## Experimento 1 — Pack Tri-Layer (core/catalog/active)
- **Objetivo:** reduzir custo e drift sem sacrificar groundedness em code review.
- **Entrada necessária:**
  - Repositório alvo (ex.: `packages/kodus-flow` ou outro projeto interno).
  - Casos reais de review (PRs recentes) + set de perguntas/respostas esperadas.
- **Implementação proposta:**
  1. Definir `core layer` (instruções globais, policies, identidade do reviewer).
  2. Construir `catalog layer` com metadados (lista de arquivos tocados, spec/resumo, histórico breve).
  3. Gerar `active layer` sob demanda (diffs, snippets relevantes, resultados de ferramentas).
  4. Usar `ContextResourceRef` para apontar recursos pesados (scripts de testes etc.).
  5. Instrumentar `ContextService` para registrar tokens por camada e groundedness.
- **Pipeline inicial:** script que monta pack tri-layer vs pack baseline (dump de diff). Rodar ambos e comparar métricas.
- **Métricas:** tokens/camada, groundedness (LLM-judge + reviewers humanos), custo/token.
- **Critério:** ≥20% redução de tokens e manutenção de groundedness.

-## Experimento 3 — Selector Híbrido de Baixo Custo
- **Objetivo:** aumentar recall e explicabilidade com custo baixo (sem grafos pesados).
- **Entrada necessária:**
  - Corpus técnico/políticas, pull requests, specs.
  - Perguntas multi-hop de teste com gabarito.
- **Implementação proposta:**
  1. Construir pipeline BM25 + embeddings (Weaviate/FAISS) com heurísticas de prioridade (arquivos do PR, labels). 
  2. Extrair informação estrutural leve (AST, dependências diretas, call graph básico) usando tree-sitter ou scripts.
  3. Durante a seleção, combinar scores: lexical + vetorial + heurísticas (dependências afetadas, módulos sensíveis).
  4. Geração de mini-grafos locais (adjacency lists) apenas para diffs atuais; usar como metadado no catalog layer.
  5. Integrar saída no `ContextPack` (catalog/active) com citações e notas explicativas.
- **Métricas:** F1/coverage, groundedness, tokens gastos, tempo de retrieval.
- **Critério:** ≥12% aumento de cobertura vs vetorial puro mantendo custo (tokens/latência) baixo.

## Experimento 8 — Telemetria e Drift
- **Objetivo:** observar saúde do contexto em produção piloto.
- **Entrada necessária:**
  - Ambiente controlado (ex.: agente interno já em uso) com logs disponíveis.
  - Eventos definindo sucesso/falha (groundedness manual, feedback usuário).
- **Implementação proposta:**
  1. Implementar `ContextEvent` logging (selection, delivery, update, error) na pipeline.
  2. Persistir métricas em storage (ex.: PostgreSQL, Prometheus, ou logs estruturados).
  3. Criar dashboard inicial (ex.: Grafana) para tokens/layer, reuse rate, groundedness score.
  4. Definir alertas (thresholds de tokens, rot detectado, groundedness baixo).
- **Métricas:** tokens, groundedness, reuse, alert frequency.
- **Critério:** relatórios mensais + alertas úteis (ex.: pack acima do limite). 
