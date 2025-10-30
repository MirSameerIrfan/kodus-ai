# Arquitetura – Context OS para Bugs (Agnóstico de Stack)

## Visão Geral

```
Bug/Alert Source --> BugSpec Builder --> Context Store / Graph Layer
                               |                |
                               |                --> Context Service / Pack Builders
                               |                --> Telemetry & Alerts
                               |                         |
CI/PR Integration <------------+--------------------------+
```

## Componentes Principais

1. **Event Ingestion Layer**
   - Conectores para Jira/Linear, Sentry/Datadog, Git commits/PRs.
   - Normalizam eventos em `KnowledgeItem` (`domain: bug`, `incident`, `commit`).
   - Cada KnowledgeItem inclui metadados (confidencialidade, owner, timestamps, TTL).

2. **BugSpec Service**
   - Recebe eventos e gera/atualiza o BugSpec (template Markdown/JSON).
   - Campos obrigatórios: sintomas, regra de negócio, causa raiz, commits, testes, mitigação.
   - Exposto via API/CLI → tanto humanos quanto automações conseguem atualizar.
   - Mantém histórico (versões) para reaberturas.

3. **Context Store / Graph Layer**
   - Armazena BugSpec e relacionamentos (bug ↔ commit ↔ arquivo ↔ teste ↔ owner ↔ doc).
   - Pode ser:
     - Relacional (PostgreSQL) com tabelas normalizadas + views para consulta.
     - JSON/SQLite com adjacency simples para pequenos times.
     - (Opcional) grafo (Graphiti/Neo4j) se quisermos visualização rica, mas mantendo ingestão manual controlada.
   - Importante: APIs agnósticas (REST/GraphQL) para ler relacionamentos.

4. **Context Service**
   - Abstração que reparte context packs para agentes/LLM.
   - Para cada bug/PR cria `LayerInputContext` com dados do BugSpec + diffs/testes.
   - Usa `ContextLayerBuilder` (core/catalog/active) conforme fluxo tri-layer.
   - Mantém `RuntimeContextSnapshot` e snapshots de sessão.

5. **CI / PR Integration**
   - GitHub Actions / GitLab CI / Jenkins / Danger bot.
   - Valida se BugSpec está completo (`root_cause`, `test_suite`, `owner`).
   - Posta comentário automático com o resumo do bug. 
   - Atualiza context store (link pr_id → bug_id). 

6. **Telemetry & Drift Monitoring**
   - Integra com contexto existente (Sentry, Datadog). 
   - Registra eventos `ContextEvent` (SELECTION, DELIVERY, UPDATE, ERROR). 
   - Problema reapareceu? Gera `ERROR` com referência ao bug e reabre ciclo. 

7. **Frontend / Dashboard**
   - Interface web para visualizar bugs, specs, relacionamentos, status (quem está fazendo o quê).
   - Poderia integrar com já existentes (Jira, Linear) via app/plugin.

## Fluxo Principal

1. **Bug vem do Jira/Sentry**
   - Ingestão cria BugSpec inicial e grava no Context Store. 
2. **Dev/triager atualiza BugSpec**
   - API/CLI ou UI do BugSpec Service. Danger/CI valida.
3. **PR aberto**
   - CI consulta Context Service → pack tri-layer inclui BugSpec, diffs, testes.
   - Comentário automático no PR com resumo + checklists. 
4. **Merge/Release**
   - CI informa BugSpec Service (fix_commit, testes atualizados). 
   - Telemetria monitora alertas. 
5. **Regressão**
   - Alarm dispara. Context Service gera notificação referenciando BugSpec anterior. 
   - Novo ciclo com histórico pronto.

## Considerações
- **Agnóstico**: componentes expostos via interfaces REST/GraphQL/CLI; integra com qualquer tracker/CI.
- **Escalável**: começa simples (JSON + scripts) e evolui para grafos/dashboards conforme necessidade.
- **Governança**: fields auditados (lineage), controle de acesso por domínio/confidencialidade. 
- **Automação first**: humanos interagem através de ferramentas que já usam (Jira, GitHub, Slack), sem etapas extras manuais.
