# Pesquisa Context-OS & Context Engineering — Outubro/2025

## Visão Geral

Levantamento de referências recentes (até out/2025) sobre context engineering,
memória corporativa para agentes, skills/tooling e governança. Fontes incluem
blogs especializados, relatórios técnicos e guias práticos usados por equipes de
agentes.

## Achados Principais

| Fonte | Data | Categoria | Insights | Relevância |
| --- | --- | --- | --- | --- |
| [Byterover – 3 Context Engineering Tips for ClaudeCode](https://www.byterover.dev/blog/3-context-engineering-tips-for-claudecode) | 25 out 2025 | Práticas de agentes / contexto ativo | Estratégias de trimming (`CLAUDE.md` enxuto), slash commands para inicialização rápida e uso de memória dinâmica via MCP (store/retrieve). Enfatiza delegação para sub-agents e paralelismo para preservar contexto principal. | Alta – valida tri-layer + sub-agents + necessidade de skill packs declarativos. |
| [Latent Space – “RAG is Dead, Context Engineering is King” (Jeff Huber, Chroma)](https://www.latent.space/p/chroma) | 19 ago 2025 | Arquitetura / Governança | Defende pipeline híbrido (dense+lexical) com rerank consistente e monitoramento de “context rot”. Sugere gold set + CI para medir groundedness. Referencia trabalhos de Lance Martin/Dex Horthy. | Alta – reforça necessidade de store híbrido, métricas de rot e budget controlado (bancos tipo Weaviate/pgvector). |
| [arXiv 2510.04618 – Agentic Context Engineering (ACE)](https://arxiv.org/pdf/2510.04618) | 7 out 2025 | Framework de autoaperfeiçoamento | ACE trata contexto como “playbook” evolutivo (bullets com metadata) mantido por pipeline Generator → Reflector → Curator. Evita “context collapse” com deltas incrementais, contadores de helpful/harmful, dedupe e refinamentos multi-epoch. Mostra ganhos 10–17% em AppWorld/finance usando apenas feedback de execução. | Alta – oferece blueprint direto para nosso Context Fabric (linhas de evolução, counters, grow-and-refine). |
| [Chroma Research – Context Rot Report](https://research.trychroma.com/context-rot) | jul 2025 | Benchmark / Observabilidade | Mostra que desempenho degrada com contexto longo, mesmo em tarefas simples. Reforça importância de controlar similaridade, distratores e estrutura do haystack. | Alta – dá base quantitativa para limite de tokens e políticas de compaction. |
| [Lance Martin – Context Engineering for Agents](https://rlancemartin.github.io/2025/06/23/context_engineering/) | 23 jun 2025 | Taxonomia / Skills | Classifica estratégias em **write / select / compress / isolate**; referencia scratchpads, sub-agents, isolação de contexto via ambientes (CodeAgent). | Alta – inspira desenho dos bundles + fabric + skill registry. |
| [Hugging Face – Open Deep Research](https://huggingface.co/blog/open-deep-research) | 08 out 2024 (revisitado em 2025) | Ferramental / Skills | Framework open-source que usa CodeAgent + sandbox para isolar estado; lista ferramentas mínimas (web browser, text inspector) e roadmap para multimodal. | Média – bom guia para skill/action packs reutilizáveis sobre MCP/workflows. |
| [Anthropic – Claude tool use GA](https://www.anthropic.com/news/tool-use-ga) | 2024 (ainda referência) | Tool orchestration | Tool use com streaming, forced tool selection, subagents em paralelo. [Estudos internos] mostram ganho usando tags de pensamento. | Média – confirma necessidade de telemetry ACTION_* e forced tool policies. |

## Lacunas Identificadas

1. **Store Persistente** – Nenhuma referência moderna suporta contexto puramente
   em memória; todos insistem em armazenar knowledge (vector + sparse) com
   lineage e rot detection. Nosso protótipo em JSON precisa migrar para storage
   real + índices híbridos.
2. **Skills Declarativas** – ByteRover e Anthropic tratam skills como pacotes
   versionáveis com instruções + toolchain. Precisamos materializar `SkillSet`
   (YAML/DB) + loader e injecção no bundle.
3. **Métricas & Gold Sets** – Chroma recomenda benchmarks de regressão. Falta
   pipeline automatizado (CI) avaliando packs gerados vs gold (ex.: bug review
   com anotações humanas).
4. **Paralelismo/Sub-agents** – estratégias de out-of-loop paralelism (slash
   commands) devem ser modeladas como `actions` no pack (gatilho `async` ou
   `background`), com telemetria extra.

## Próximos Passos Sugeridos

1. **Knowledge Fabric**: evoluir `store.json` para backend real (Postgres +
   pgvector ou Chroma Cloud) com API CRUD + sync de lineage/TTL.
2. **ACE-style evolutions**: implementar pipeline Generator/Reflector/Curator
   para gerar deltas de contexto (bullets com counters helpful/harmful,
   dedupe semântico, grow-and-refine) usando logs de execução.
3. **Skill Registry**: implementar loader YAML → `SkillDefinition` + merge com
   snapshot/bundle; permitir habilitar/desabilitar por tenant/intent.
4. **Telemetry & Benchmarks**: estruturar `ACTION_*` com métricas (latência,
   sucesso, tokens) e preparar gold set mínimo (k>20) para regressões.
5. **Background Actions/Sub-agents**: criar contrato `trigger: 'async'` e
   orquestrador que lide com múltiplas janelas (apoiado em lessons do
   ByteRover/Hugging Face).

## Observações

- Continuar monitorando Latent.Space (série “Context Rot”, “Context Engineering”),
  ByteRover blog e relatórios do Chroma Research para atualizações.
- Falta cross-check com universos corporativos (Microsoft Magentic-One,
  Google Agent Playground); incluir na próxima rodada se material público
  estiver disponível.
