# Matriz de Experimentos – Context OS

> Estrutura: Objetivo → Técnica/Hipótese → Dataset → Métricas → Critério de sucesso → Prioridade

| # | Objetivo | Técnica / Hipótese | Dataset / Domínio | Métricas | Critério de sucesso | Prioridade |
|---|----------|--------------------|-------------------|----------|---------------------|------------|
| 1 | Reduzir custo e drift no contexto | Implementar **pack tri-layer** (core/catalog/active + resources on-demand) | Code review (repo interno) | Tokens por camada, groundedness, custo/token | ≥20% menos tokens vs baseline sem perda de groundedness | Alta |
| 2 | Identificar limites de contexto seguro | Rodar **Context Rot benchmark** em dados reais | Perguntas longas (suporte, jurídico) | Accuracy vs context length, latência | Curva de rot + thresholds para packs | Alta |
| 3 | Melhorar recall multi-hop / explicabilidade com custo baixo | Implementar **selector híbrido leve**: BM25 + embeddings + heurísticas de dependência/topologia (ex.: AST) | Documentação técnica / políticas | F1, coverage, groundedness | +12% cobertura vs vetorial puro com custo reduzido | Alta |
| 4 | Aumentar coerência em code brownfield | Aplicar **Frequent Intentional Compaction** (ACE) | Projetos código legado | Tempo entrega, rework, tokens usage | Reduz rework >30%, mantém budget 40-60% | Média |
| 5 | Integrar memória híbrida | Conectar **MemOS/mem0** ao Context Service | Conversas recorrentes (CRM) | Reuse rate, groundedness, feedback | +20% reuse, feedback positivo | Média |
| 6 | Enriquecer reasoning | Inserir **cognitive tools** no pack | QA analítico / suporte | Pass@1, groundedness, citações | +10 pts pass@1, respostas citadas | Média |
| 7 | Avaliar formatação customizada | Testar formato 12-Factor (YAML/JSON custom) | Agente TI / DevOps | Tokens, precisão, estabilidade | 10-15% economia sem perda de acurácia | Média |
| 8 | Monitorar drift em produção | Instrumentar **ContextTelemetry** | Piloto em produção | Groundedness, reuse, alertas | Relatórios mensais + alertas úteis | Alta |
