# TODO · Context-OS rumo à produção

- [ ] **Persistência e Store**
  - Migrar dataset atual (store.json, bullets ACE, regras) para Weaviate com script automatizado.
  - Cobrir `WeaviateKnowledgeStore` com testes (CRUD, filtros, busca híbrida) e smoke-test (`scripts/weaviate-smoke.ts`).
  - Externalizar configuração (URL/API key/classe) via env/loader mantendo fallback apenas para o laboratório.
  - Documentar backup/restore e integrar verificação de saúde no CI.

- [ ] **Selectors & Prompts**
  - Substituir fallback de RetrievalResult na pipeline de review por selectors reais consultando Weaviate (BM25/híbrido).
  - Propagar metaprompts/MCP/tool configs dos `v2PromptOverrides`, persistindo actions/materializers com herança.
  - Descrever fluxo de edição/salvamento de configs (UI/serviço) incluindo trigger/type/action metadata e dedupe.

- [ ] **Actions / MCP / Workflows**
  - Unificar `ActionExecutor` (triggers + MCP + workflows internos) com telemetria ACTION_* e métricas.
  - Completar suporte a sampling/elicitation e recursos no MCP adapter (listResources/readResource, approval handlers).
  - Configurar políticas de segurança/quota do `SecurityManager` por tenant e permitir override via config.

- [ ] **Ingestão / Knowledge Fabric**
  - Construir conectores reais (BugSpec, metadata de PR, AST) gerando `KnowledgeItem` com lineage, TTL e confidencialidade.
  - Preparar pipelines de ingestão com validação, persistência Weaviate e alertas de falha/latência.
  - Padronizar APIs de lineage & feedback (append/update) em workflows reais.

- [ ] **Observabilidade & Ferramentas**
  - Atualizar README do laboratório com auto-detecção Docker e comandos revisados.
  - Criar regressão automatizada (goldsets) comparando saídas do bundle vs. expectativas.
  - Expor métricas (latência/erros) e dashboards para ingest, selectors e actions.

- [ ] **Infraestrutura / Compose**
  - Evoluir `docker-compose.weaviate.yml` com módulos adicionais (generative, vectorizer custom) e secrets seguros.
  - Habilitar autenticação (API key/RBAC) e gerenciamento de secrets para ambientes.
  - Validar recursos/limites e incluir scripts de provisionamento para ambientes não-docker.

