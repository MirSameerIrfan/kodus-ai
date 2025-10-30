# Context Engineering – Deep Research Notes

_Atualizado em: 2025-10-28_

Este documento consolida leituras (papers, blogs, repositórios e docs) sobre **context engineering, context OS, context augmentation, agentic workflows** e temas adjacentes. O objetivo é mapear pontos fortes/fracos, técnicas recorrentes e oportunidades para construirmos um Context OS superior.

---

## 1. Objetivos da pesquisa

- **Ler e resumir** as referências mais citadas em 2025 sobre context engineering / context OS.
- **Avaliar técnicas** (pipelines, heurísticas, métricas) e identificar o que funciona ou não.
- **Comparar players** (open-source e comerciais) para extrair diferenciais e lacunas.
- **Gerar backlog de experimentos** com base nas melhores ideias observadas.

> **Fichamentos detalhados:** ver `context-engineering/fichamentos/` (survey arXiv, Chroma Context Rot, IBM cognitive tools, etc.).

---

## 2. Tabela de fontes analisadas

| Fonte | Tipo | Destaques / Técnicas | Pontos positivos | Limitações / Gaps | Link |
| --- | --- | --- | --- | --- | --- |
| Philipp Schmid – “The New Skill… Context Engineering” | Blog (2025-06-30) | Define contexto em camadas (instruções, histórico, memória longa, RAG, tools, output) e enfatiza “sistema, não string”. | Linguagem acessível, checklist de componentes. | Pouco detalhado sobre governança/observabilidade. | https://www.philschmid.de/context-engineering |
| Simon Willison – “Context engineering” | Blog (2025-06-27) | Context engineering como termo superior a prompt engineering; cita Karpathy/Lütke. | Reforça necessidade de compaction, ferramentas, histórico. | Alto nível; não entra em pipelines práticos. | https://simonwillison.net/2025/Jun/27/context-engineering/ |
| LangChain Blog – “The rise of context engineering” | Blog (2025-06-23) | Context=true dynamic system; foco em LangGraph/LangSmith para controle/observabilidade. | Destaca importância de formato e ferramentas; cases práticos. | Enfoque promocional no stack LangChain. | https://blog.langchain.com/the-rise-of-context-engineering/ |
| R. Lance Martin – “Context Engineering for Agents” | Artigo técnico (2025-06-23) | Divide abordagens em **write, select, compress, isolate**; discute problemas (poisoning, distraction, confusion, clash). | Excelente taxonomia + exemplos (scratchpads, notebooks, subagentes). | Falta métricas concretas; foco em visão qualitativa. | https://rlancemartin.github.io/2025/06/23/context_engineering/ |
| Kubiya – “Context Engineering for Reliable AI Agents” | Blog / Produto (2025-07-17) | Context OS ↔ 12-Factor Agents; tool calls como JSON; separar raciocínio de execução. | Articula princípios de engenharia (ownership, modularidade). | Poucos detalhes técnicos sobre storage/selection. | https://www.kubiya.ai/blog/context-engineering-ai-agents |
| Mindset AI – “What is Context Engineering?” | Blog / Podcast (2025-07-10) | Camadas: imediato, system, histórico, memória longa, RAG, tools. ênfase em orquestração simples. | Valoriza governança, avaliação, multi-agente. | Conteúdo marketing; faltam benchmarks. | https://www.mindset.ai/blogs/in-the-loop-ep23-what-is-context-engineering |
| Chroma Research – “Context Rot” | Paper + repo (2025-07) | Demonstra degradação de performance com contextos longos; propõe benchmark multi-domínio. | Oferece código e metodologia para testes sintéticos. | Não sugere correções (apenas diagnóstico). | https://research.trychroma.com/context-rot / https://github.com/chroma-core/context-rot |
| “A Survey of Context Engineering for LLMs” (Mei et al., 2025) | Survey acadêmico | Taxonomia: retriev./process./management + implementações (RAG, memory, tools, multi-agent); cita 1400 papers. | Panorama completo + revela gap: assimetria entre compreender contexto e gerar outputs. | Extenso; poucas recomendações práticas diretas. | https://arxiv.org/abs/2507.13334 |
| IBM Zurich – “Eliciting Reasoning with Cognitive Tools” | Paper (2025-06) | “Cognitive tools” aumentam reasoning (GPT-4.1 pass@1 26.7 → 43.3). Mostra pipeline de tool orchestration. | Inspira integração de toolkits no pack (contexto sugere sequência). | Foca em reasoning matemático; não aborda ingestão. | https://arxiv.org/abs/2506.12115 |
| Microsoft GraphRAG | Repo / Metodologia | Indexação em grafo + RAG; processos de clusterização, prompt tuning, pipeline CLI. | Fortalece ideia de grafos como memória estruturada; docs completas. | Indexação cara; pipeline complexo; sem governança embutida. | https://github.com/microsoft/graphrag |
| MemOS | Repo | “Memory OS” com MemCube (textual, ativação, paramétrica), APIs, benchmarks. | Aborda memória híbrida + interface unificada; resultados fortes (LOCOMO). | Foco em memória; menos ênfase em ingestão multi-fonte/grafo. | https://github.com/MemTensor/MemOS |
| HumanLayer – ACE (Advanced Context Engineering for Coding Agents) | Guia técnico (2025-08) | Frequent Intentional Compaction (research → plan → implement), triagem de tokens 40-60%, specs como código, workflows para codebases brownfield. | Fornece estratégias detalhadas de compaction e alinhamento humano → AI; casos reais (Rust 300k LOC). | Focado em código; depende de muita curadoria manual; pouca automação governança. | https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md |
| Context Space – “Context is the new engine” | Blog / Produto (2025-07-09) | Defende Context OS com MCP + integrações; pipelines write/select/compress/isolate; roadmap com context analytics. | Visão arquitetural clara; foco em integrações (14+ serviços) e segurança (Vault, JWT); destaca MCP como “HTTP do contexto”. | Conteúdo marketing; funcionalidades (retrieval, scoring) ainda roadmap. | https://context.space/blogs/context-is-the-new-engine |
| Neo4j – “What is GraphRAG?” | Blog técnico (2024-12-05) | Explica limitações de RAG vetorial, uso de grafos para multi-hop, pipeline SimpleKGPipeline + retriever VectorCypher. | Mostra implementação prática (Neo4j + OpenAI) e métricas de explainability. | Enfoque em chunk→grafo; não cobre governança/token budget. | https://neo4j.com/blog/what-is-graphrag/ |
| HumanLayer – 12-Factor Agents: Own Your Context Window | Guia (2025) | Sugere formatos customizados de contexto, serialização YAML/JSON, controle manual do payload. | Reforça controle total do contexto (não depender de formato chat), dicas aplicáveis. | Foco em orientação; sem métricas/benchmarks. | https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-03-own-your-context-window.md |
| Anthropic Claude Skills Docs | Doc oficial | **Arquitetura tri-layer** (metadata residente, instructions on-demand, resources via filesystem). | Modelo de progressive disclosure + zero token cost p/ scripts. | UX orientada ao Claude; não discute multi-tenant/governança. | https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview |
| 12-Factor Agents (HumanLayer) | Guia open-source | Princípios: own your context window, own your prompts, etc. | Checklists práticos para pipelines e governance. | Ainda fragmentado; falta implementação plug-and-play. | https://github.com/humanlayer/12-factor-agents |
| Awesome Context Engineering | Repositório de recursos | Hub com links para papers/projetos (MemOS, GraphRAG, MEM0 etc.). | Excelente índice para explorar lacunas. | Não sintetiza; serve como catálogo. | https://github.com/Meirtz/Awesome-Context-Engineering |

---

## 3. Temas recorrentes e técnicas

1. **Camadas de contexto**  
   - Mínimo: instruções/resident + catálogo leve + payload on-demand (Claude Skills).  
   - Expandido: incluir histórico resumido, entidades, ferramentas, memória longa, citações.  
   - Técnicas de compaction: map-reduce sumarization, dedupe por embeddings, budgets dinâmicos.

2. **Pipelines Write / Select / Compress / Isolate**  
   - _Write_: scratchpads, memórias persistentes (MemOS, mem0).  
   - _Select_: cascata lexical → vetorial → grafos (GraphRAG).  
   - _Compress_: context rot benchmarking para ajustar heurísticas; sumarização hierárquica.  
   - _Isolate_: subagentes com contextos menores, sandboxes (e2b), states tipados (LangGraph).  
   - **Frequent Intentional Compaction (ACE)** mantém contexto útil entre 40-60% e reescreve progresso em specs versionadas.

3. **Governança e observabilidade**  
   - LangSmith / Arize / Augment para lineage, groundedness.  
   - Kubiya e Mindset falam em “own your control loop”, “context contracts”.  
   - Survey aponta falta de métricas padronizadas; Chroma sugere usar LLM-judge + variação de input length.

4. **Memória híbrida**  
   - MemOS e MEM1 demonstram ganhos em multi-hop e temporal reasoning.  
   - Técnicas: separar textual, ativação (KV cache), paramétrica (LoRAs), embeddings.  
   - Integração com context packs: referências a memórias atômicas (ContextResourceRef).

5. **Tool orchestration e cognitive tools**  
   - IBM mostra ganho com “toolkits” predefinidos; Kubiya reforça JSON determinístico.  
   - Claude Skills + Agents: scripts e templates residem fora do contexto, carregados via tools.  
   - Context Space posiciona MCP como “HTTP do contexto” para leitura/escrita padronizada.

6. **Grafos e temporalidade**  
   - GraphRAG + Graphiti cuidam de entidades, clusters, `valid_at`; Neo4j mostra pipelines (SimpleKGPipeline + VectorCypher).  
   - Gaps: poucos tratam de policies (RBAC/ABAC) embutidas no grafo; oportunidade para evoluir.

7. **Formatação customizada de contexto**  
   - 12-Factor Agents recomenda fugir do formato chat padrão, serializar eventos/estado em YAML/JSON, paleta de prompts custom.  
   - Reforça que “own your context window” = flexibilidade máxima para experimentar estruturas.

---

## 4. Padrões positivos x lacunas

| Aspecto | O que funciona bem | O que falta / oportunidades |
| --- | --- | --- |
| **Camadas** | Claude Skills tri-layer; frameworks com budgets | Embutir políticas e auto-explicações (“por que incluí este trecho”) |
| **Seleção** | Cascatas combinando lexical, vetorial, grafo; heurísticas Write/Select/Compress/Isolate | Seleção aware de políticas, sensibilidade e custo; grafos temporais + RBAC |
| **Memória** | MemOS integra textual+KV+LoRA; mem0 leves | Conectar memória a context packs com lineage (quem leu o quê) |
| **Observabilidade** | LangSmith / Arize / Chroma fornecem métricas | Dashboards focados em “Context Ops” ainda raros; medir reuse/rot em produção |
| **Governança** | 12-Factor Agents / Kubiya falam em ownership | Ferramentas visuais para context contracts, approval flows |
| **Tool use** | IBM cognitive tools, Kubiya JSON tool outputs | Integrar Sugestões de toolkits automáticas no pack builder |

---

## 5. Ações sugeridas / backlog de pesquisa

1. **Releitura + fichamento completo do survey (Mei et al.)** com mapa de técnicas → priorizar para experimentos.  
2. **Replicar benchmark Context Rot** com nossos datasets (code review, suporte, jurídico).  
3. **Prototipar pack tri-layer** (core/catalog/active + `ContextResourceRef`) e medir custo vs. baseline.  
4. **Experimentos de selector**: testar cascata lexical → vetorial → grafo com reranker; comparar com approach simples.  
5. **Integrar memória híbrida (MemOS)** e medir ganho em tasks com continuidade (temporais).  
6. **Implementar telemetria ContextEvent/ContextTelemetry** para tokens por camada, groundedness, reuse.  
7. **Criar “context contracts”** – YAML ou UI – com owners, SLA, TTL, políticas.  
8. **Analisar docs do Claude Skills** para replicar progressive disclosure (resources off-context).  
9. **Experimentar Frequent Intentional Compaction (ACE)** em codebases internas; medir produtividade vs. baseline.  
10. **Investigar MCP / Context Space** para definir padrão de integração e segurança multi-serviços.  
11. **Avaliar implementação GraphRAG/Neo4j** (SimpleKGPipeline + VectorCypher) em nossos dados.  
12. **Experimentar formatos customizados (12-Factor)** para reduzir tokens e melhorar clareza.  
13. **Buscar discussões em X/LinkedIn/Discord** (Akshay Pachaar, Dex Horthy, Anthropic devrel) para insights emergentes.  
14. **Mapear lacunas de produto** (ex.: grafos com políticas, co-pilot de curadoria) e desenhar PoCs.

---

### Próximos passos imediatos
- [ ] Fichar integralmente os artigos/papers principais (survey, Chroma, IBM).  
- [ ] Documentar heurísticas de seleção atuais e possíveis melhorias baseadas em Write/Select/Compress/Isolate.  
- [ ] Definir métricas padrão para “Context Ops” (tokens/layer, groundedness, reuse, rot).  
- [ ] Planejar experimentos (matriz: objetivo → técnica → dataset → métrica).  
- [ ] Agendar sessões semanais de revisão das novas publicações e atualizações open-source.

---

_Este arquivo é vivo. Atualize sempre que novas leituras forem feitas ou novos experimentos concluídos._
