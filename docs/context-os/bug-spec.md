# Estrutura Proposta – BugSpec

> Objetivo: garantir que cada correção de bug registre contexto suficiente para evitar regressões futuras e servir de memória no Context OS.

## 1. Campos do BugSpec
- **Identificação**
  - `bug_id`: chave do tracker (Jira/Linear/etc.).
  - `serviço/módulo`: domínio impactado.
  - `severity`: P0/P1 etc.
  - `status`: aberto → em correção → resolvido.
- **Sintomas**
  - Descrição resumida do problema em produção (logs, stacktrace).
  - Eventos/alertas relacionados (link Sentry/Datadog).
- **Contexto histórico**
  - PRs/incidentes anteriores conectados (`related_bugs`).
  - Releases em que ocorreu.
- **Regra de negócio**
  - Qual requisito foi violado? (descrição ou link a documentação).
- **Causa raiz (root cause)**
  - Explicação técnica + porque aconteceu (processo/regra mal entendida?).
- **Correção**
  - Commit/PR atual (`fix_commit`).
  - Arquivos alterados e teste(s) adicionados/atualizados (`test_suite`).
  - Lista de passos manuais (se houver) e owners consultados.
- **Mitigação/prevenção**
  - Feature flags envolvidos, alertas ajustados.
  - Medidas para evitar reintrodução (ex.: foi criado test regression? Documentação atualizada?).
- **Notas adicionais**
  - Links para post-mortem, decisões, gravações.

> Cada BugSpec vira um `KnowledgeItem` com domínio `bug`, confidencialidade (ex. `internal`), `ttl` (até bug fechado) e lineage (quem editou, quando).

## 2. Workflow proposto

1. **Report**
   - Quando o bug é criado ou um alerta dispara, gerar BugSpec inicial (pode vir de template em Markdown).

2. **Enriquecimento**
   - Desenvolvedor/triager preenche sintomas, contexto, causa raiz.
   - Danger/CI garante que campos essenciais foram preenchidos.

3. **Correção**
   - Ao abrir PR, pipeline injeta resumo do BugSpec (Context Pack) com checklists:
     - Testes associados rodaram?
     - Documentação atualizada?
     - Owners consultados?
   - `ContextLayerBuilder` usa BugSpec como `catalog layer` para o review.

4. **Deploy / Monitor**
   - Após merge, telemetria monitora logs/alerts relacionados (para detectar regressão).
   - Se reocorrer, fluxo reabre bug com BugSpec anterior como contexto base.

5. **Memória**
   - BugSpec fica disponível para busca (NLP, heurísticas) sempre que surgir algo parecido.

## 3. Ferramentas de suporte
- Template Markdown (pode ser gerado via CLI ou bot).
- Scripts para extrair commits/arquivos/testes ligados (integrados ao CI).
- Dashboard (“Bug Contracts”) mostrando status e quem é responsável.
- Notificações Danger/Slack quando BugSpec não está completo.

## 4. Relação com o Context OS
- BugSpec → `KnowledgeItem` (domínio `bug`).
- Hashtable/adjacency simples liga BugSpec → PR → arquivos → testes → owners.
- `ContextService` registra updates de sessão quando bug é reaberto ou monitorado.
- Packs tri-layer incluem seções específicas para bugs (core = políticas de bugfix, catalog = BugSpec resumo, active = diffs e testes ligados).
