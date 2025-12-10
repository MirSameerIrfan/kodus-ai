# Refatoração: Estrutura do Pipeline de Code Review

**Data**: 2025-01-27
**Responsável**: Kodus AI Assistant
**Contexto**: Reorganização dos arquivos do pipeline de Code Review para melhor clareza, separação de responsabilidades (Base vs Enterprise) e alinhamento com a arquitetura de Workflow Queue.

---

## 🔄 De-Para Estrutural

A estrutura antiga estava misturada entre `infrastructure/codeReviewPipeline` e `ee/pipeline`. A nova estrutura centraliza tudo em `libs/code-review/pipeline`.

### 1. Base (Pipeline Code Review)

Arquivos comuns e lógica de execução do pipeline.

| Antigo Caminho                                                   | Novo Caminho                               | Descrição                                                        |
| ---------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `libs/code-review/infrastructure/codeReviewPipeline/pipeline/`   | `libs/core/workflow/engine/executor/`      | Executor (DurablePipelineExecutor) - **GENERALIZADO**            |
| `libs/code-review/infrastructure/codeReviewPipeline/pipeline/`   | `libs/core/workflow/engine/state/`         | PipelineStateManager - **GENERALIZADO**                          |
| `libs/code-review/infrastructure/codeReviewPipeline/stages/`     | `libs/code-review/pipeline/base/stages/`   | Stages padrão (Validate, Resolve Config, Comments)               |
| `libs/code-review/infrastructure/codeReviewPipeline/handlers/`   | `libs/core/workflow/engine/handlers/`      | Handlers de eventos (HeavyStage, EventBuffer) - **GENERALIZADO** |
| `libs/code-review/infrastructure/codeReviewPipeline/context/`    | `libs/code-review/pipeline/base/context/`  | Definição do Contexto do Pipeline                                |
| `libs/code-review/infrastructure/codeReviewPipeline/strategies/` | `libs/code-review/pipeline/base/strategy/` | (Removido estratégia base antiga, mantida apenas EE)             |

### 2. Enterprise (EE)

Recursos avançados e pagos (AST, Fine-Tuning).

| Antigo Caminho                                               | Novo Caminho                                                 | Descrição                            |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------ |
| `libs/code-review/ee/pipeline/strategies/`                   | `libs/code-review/pipeline/ee/strategies/`                   | Estratégia completa (com stages EE)  |
| `libs/code-review/ee/pipeline/stages/`                       | `libs/code-review/pipeline/ee/stages/`                       | Stages Enterprise (AST, Fine-Tuning) |
| `libs/code-review/ee/pipeline/fileReviewContextPreparation/` | `libs/code-review/pipeline/ee/fileReviewContextPreparation/` | Preparação de contexto avançada      |

### 3. Workflow Engine (Novo Core)

O antigo módulo `libs/workflow-queue` foi movido para `libs/core/workflow` para centralizar a infraestrutura de execução.

| Antigo Caminho         | Novo Caminho                 | Descrição                          |
| ---------------------- | ---------------------------- | ---------------------------------- |
| `libs/workflow-queue/` | `libs/core/workflow/`        | Infraestrutura de Fila e Jobs      |
| (Novo)                 | `libs/core/workflow/engine/` | Motor de Execução Durável Genérico |

---

## 🛠️ Detalhes das Mudanças

### Generalização do Executor

O `CodeReviewPipelineExecutor` foi substituído pelo `DurablePipelineExecutor` (genérico), que reside em `libs/core/workflow/engine`. Agora, qualquer módulo pode executar pipelines duráveis sem duplicar lógica de fila e estado.

### Renomeações Importantes

- A pasta `pipeline` dentro da estrutura antiga foi renomeada para `executor` para refletir melhor sua responsabilidade (executar o pipeline, não "ser" o pipeline).
- Interfaces genéricas de pipeline (como `BasePipelineStage`) agora são importadas de `libs/core/infrastructure/pipeline`, permitindo que o pipeline de Code Review foque apenas na sua lógica de negócio.

### Integração com Workflow Queue

A nova estrutura mantém total compatibilidade com a arquitetura de Workflow Queue (`ARQUITETURA-001-WORKFLOW-QUEUE.md`), preservando:

- `HeavyStageEventHandler`: Para lidar com eventos assíncronos.
- `WorkflowPausedError`: Para pausar a execução em stages pesados (AST).
- `PipelineStateManager`: Para persistência de estado no banco de dados.

### Próximos Passos

- Certificar-se de que o `CodebaseModule` (ou onde for necessário) importe o novo `CodeReviewPipelineModule`.
- Verificar se a injeção de dependência do `DurablePipelineExecutor` está funcionando corretamente nos consumers da fila.
