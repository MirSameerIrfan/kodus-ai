# Fluxo de Contexto – Bug Lifecycle

```mermaid
flowchart TD
    A[Bug Report / Alert] --> B[BugSpec Template]
    B --> C[Enriquecimento (Dev/Analista)]
    C --> D[Context Pack para correção]
    D --> E[PR Review & Commit]
    E --> F[Deploy & Telemetria]
    F --> G[Monitor regressão]
    G -->|Reabre| B
```

## 1. Bug Report / Alert
- Evento em Sentry, Datadog ou ticket manual.
- Coleta automática de logs, stacktrace, release.
- Cria BugSpec (versão inicial) em template Markdown.

## 2. Enriquecimento
- Dev/triager preenche:
  - Regra de negócio impactada.
  - Causa raiz (tecnologia/processo).
  - Lista de owners consultados.
- Danger/CI verifica campos obrigatórios (não deixa PR fechar se incompleto).

## 3. Context Pack para correção
- Quando abre correção, `ContextLayerBuilder` monta:
  - **Core:** políticas de bug (ex.: “não feche sem teste”).
  - **Catalog:** resumo BugSpec (sintomas, root cause, commit alvo, testes). 
  - **Active:** diffs e arquivos afetados + testes novos.
- PR recebe checklist automatizado (via bot).

## 4. PR Review & Commit
- Reviewer vê BugSpec no contexto, sabe por que bug surgiu, o que precisa garantir.
- Ao mergear, `ContextService` registra fix_commit, teste etc.

## 5. Deploy & Telemetria
- Telemetria (ContextTelemetry) monitora métricas do bug (erro reapareceu?).
- Se alerta disparar, evento `ERROR` reabre BugSpec.

## 6. Reabertura
- Novo ciclo começa com BugSpec anterior anexado (histórico completo).
- Permite descobrir rapidamente se correção anterior não foi entendida/seguida.
