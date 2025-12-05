# Plano de Implementação: Arquitetura Balanceada

**Data**: 2025-01-27  
**Objetivo**: Implementar arquitetura balanceada que garante responsabilidade única, fluxo completo, testabilidade, performance e manutenibilidade

---

## 🎯 Fases de Implementação

### Fase 1: Fundação (Abstrações Base)

### Fase 2: Pipeline Executor (Orquestrador)

### Fase 3: Persistência de Estado

### Fase 4: Event Handlers Genéricos

### Fase 5: Migração de Stages Existentes

### Fase 6: Testes e Validação

---

## 📋 Fase 1: Fundação (Abstrações Base)

### 1.1 Criar Interfaces Base

**Arquivo**: `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/base/stage.interface.ts`

```typescript
export interface Stage {
    readonly name: string;
    readonly dependsOn?: string[];

    execute(context: PipelineContext): Promise<PipelineContext>;
    isLight(): boolean;
    canExecute?(context: PipelineContext): Promise<boolean>;
    compensate?(context: PipelineContext, error: Error): Promise<void>;
}
```

**Arquivo**: `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/base/heavy-stage.interface.ts`

```typescript
export interface HeavyStage extends Stage {
    start(context: PipelineContext): Promise<string>;
    getResult(taskId: string): Promise<any>;
    resume(context: PipelineContext, result: any): Promise<PipelineContext>;
    readonly timeout: string;
}
```

**Arquivo**: `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/base/base-stage.abstract.ts`

```typescript
export abstract class BaseStage implements Stage {
    abstract readonly name: string;
    abstract readonly dependsOn?: string[];

    abstract execute(context: PipelineContext): Promise<PipelineContext>;
    abstract isLight(): boolean;

    protected updateContext(
        context: PipelineContext,
        updates: Partial<PipelineContext>,
    ): PipelineContext {
        return { ...context, ...updates };
    }
}
```

**Tarefas**:

- [ ] Criar `stage.interface.ts`
- [ ] Criar `heavy-stage.interface.ts`
- [ ] Criar `base-stage.abstract.ts`
- [ ] Adicionar tipos necessários em `PipelineContext`

**Estimativa**: 2-3 horas

---

### 1.2 Atualizar PipelineContext

**Arquivo**: `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context.ts`

**Adicionar**:

- `currentStage?: string` - Stage atual sendo executado
- `workflowJobId?: string` - ID do workflow job
- `serialize()` - Serializar contexto para persistência
- `deserialize(data: string)` - Deserializar contexto

**Tarefas**:

- [ ] Adicionar campos ao contexto
- [ ] Implementar `serialize()` e `deserialize()`
- [ ] Atualizar tipos TypeScript

**Estimativa**: 1-2 horas

---

## 📋 Fase 2: Pipeline Executor (Orquestrador)

### 2.1 Criar PipelineExecutor Refatorado

**Arquivo**: `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/pipeline/pipeline-executor.service.ts`

**Funcionalidades**:

- Executar stages sequencialmente
- Detectar stages leves vs pesados
- Executar stages leves diretamente
- Executar stages pesados (start + pause)
- Persistir estado após cada stage
- Retry e compensação

**Tarefas**:

- [ ] Criar `PipelineExecutor` com método `execute()`
- [ ] Implementar `executeStage()` (detecta leve vs pesado)
- [ ] Implementar `executeHeavyStage()` (start + pause)
- [ ] Implementar `handleStageFailure()` (compensação)
- [ ] Integrar com `PipelineStateManager` (Fase 3)

**Estimativa**: 4-6 horas

---

### 2.2 Atualizar CodeReviewPipelineStrategy

**Arquivo**: `src/ee/codeReview/strategies/code-review-pipeline.strategy.ee.ts`

**Mudanças**:

- Stages devem implementar `Stage` interface
- PipelineExecutor deve ser usado ao invés do executor atual

**Tarefas**:

- [ ] Atualizar strategy para usar novo `PipelineExecutor`
- [ ] Garantir que stages implementam `Stage` interface

**Estimativa**: 1-2 horas

---

## 📋 Fase 3: Persistência de Estado

### 3.1 Criar PipelineStateManager

**Arquivo**: `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/pipeline/pipeline-state-manager.service.ts`

**Funcionalidades**:

- `persistState(context: PipelineContext)` - Salva estado
- `resumeFromState(workflowJobId: string)` - Retoma estado
- `getState(workflowJobId: string)` - Busca estado atual

**Tarefas**:

- [ ] Criar `PipelineStateManager`
- [ ] Implementar persistência no banco (usar WorkflowJob ou tabela separada)
- [ ] Implementar retomada de estado
- [ ] Adicionar índices para performance

**Estimativa**: 3-4 horas

---

### 3.2 Schema de Persistência

**Opção A**: Usar `WorkflowJob` existente

- Adicionar campo `pipelineState: JSONB` em `WorkflowJob`

**Opção B**: Criar tabela separada

- `pipeline_states` com `workflow_job_id`, `state: JSONB`, `created_at`, `updated_at`

**Recomendação**: Opção A (usar WorkflowJob existente)

**Tarefas**:

- [ ] Decidir entre Opção A ou B
- [ ] Criar migration se necessário
- [ ] Atualizar `WorkflowJobModel` se Opção A

**Estimativa**: 1-2 horas

---

## 📋 Fase 4: Event Handlers Genéricos

### 4.1 Criar HeavyStageEventHandler Genérico

**Arquivo**: `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/handlers/heavy-stage-event.handler.ts`

**Funcionalidades**:

- Escutar eventos de stages pesados completados
- Encontrar workflow pausado esperando evento
- Retomar pipeline do último estado
- Buscar resultado do stage
- Continuar execução do pipeline

**Tarefas**:

- [ ] Criar `HeavyStageEventHandler`
- [ ] Implementar `onStageCompleted(event: StageCompletedEvent)`
- [ ] Integrar com `PipelineStateManager` para retomar estado
- [ ] Integrar com `PipelineExecutor` para continuar execução
- [ ] Registrar handler no módulo

**Estimativa**: 4-5 horas

---

### 4.2 Criar Tipos de Eventos

**Arquivo**: `src/core/domain/workflowQueue/enums/event-type.enum.ts`

**Eventos**:

- `AST_ANALYSIS_COMPLETED`
- `PR_LEVEL_REVIEW_COMPLETED`
- `FILES_REVIEW_COMPLETED`
- `LLM_ANALYSIS_COMPLETED`

**Tarefas**:

- [ ] Criar enum de tipos de eventos
- [ ] Criar interface `StageCompletedEvent`
- [ ] Atualizar `WorkflowPausedError` para incluir `eventType` e `eventKey`

**Estimativa**: 1 hora

---

## 📋 Fase 5: Migração de Stages Existentes

### 5.1 Migrar Stages Leves

**Stages para migrar**:

- `ValidateNewCommitsStage`
- `ResolveConfigStage`
- `ValidateConfigStage`
- `FetchChangedFilesStage`
- `LoadExternalContextStage`
- `FileContextGateStage`
- `InitialCommentStage`
- `CreatePrLevelCommentsStage`
- `CreateFileCommentsStage`
- `AggregateResultsStage`
- `UpdateCommentsAndGenerateSummaryStage`
- `RequestChangesOrApproveStage`

**Tarefas por Stage**:

- [ ] Implementar `Stage` interface
- [ ] Implementar `isLight()` retornando `true`
- [ ] Manter lógica existente em `execute()`
- [ ] Adicionar `dependsOn` se necessário
- [ ] Testes unitários

**Estimativa**: 2-3 horas por stage (total: 24-36 horas, pode paralelizar)

---

### 5.2 Migrar Stages Pesados

**Stages para migrar**:

- `CodeAnalysisASTStage` (EE)
- `ProcessFilesPrLevelReviewStage`
- `ProcessFilesReview`
- `KodyFineTuningStage` (EE)
- `CodeAnalysisASTCleanupStage` (EE)

**Tarefas por Stage**:

- [ ] Implementar `HeavyStage` interface
- [ ] Implementar `isLight()` retornando `false`
- [ ] Implementar `start()` - inicia análise assíncrona
- [ ] Implementar `getResult()` - busca resultado
- [ ] Implementar `resume()` - retoma com resultado
- [ ] Definir `timeout`
- [ ] Publicar evento quando análise completar
- [ ] Testes unitários

**Estimativa**: 4-6 horas por stage (total: 20-30 horas)

---

## 📋 Fase 6: Testes e Validação

### 6.1 Testes Unitários de Stages

**Para cada stage**:

- [ ] Teste de execução bem-sucedida
- [ ] Teste de erro (se aplicável)
- [ ] Teste de compensação (se aplicável)
- [ ] Teste de `canExecute()` (se aplicável)

**Estimativa**: 1-2 horas por stage

---

### 6.2 Testes de Integração do Pipeline

**Cenários**:

- [ ] Pipeline completo executa até o fim
- [ ] Pipeline pausa em stage pesado e retoma
- [ ] Pipeline retoma após worker crashar
- [ ] Pipeline compensa em caso de falha
- [ ] Pipeline executa stages em ordem correta (dependências)

**Estimativa**: 6-8 horas

---

### 6.3 Testes End-to-End

**Cenários**:

- [ ] Webhook → Pipeline completo → Comentários criados
- [ ] Webhook → Pipeline pausa → Evento chega → Pipeline retoma → Comentários criados
- [ ] Múltiplos PRs em paralelo

**Estimativa**: 4-6 horas

---

## 📊 Cronograma Estimado

| Fase       | Tarefas                | Estimativa       | Prioridade |
| ---------- | ---------------------- | ---------------- | ---------- |
| **Fase 1** | Fundação (Abstrações)  | 3-5 horas        | 🔴 Alta    |
| **Fase 2** | Pipeline Executor      | 5-8 horas        | 🔴 Alta    |
| **Fase 3** | Persistência de Estado | 4-6 horas        | 🔴 Alta    |
| **Fase 4** | Event Handlers         | 5-6 horas        | 🔴 Alta    |
| **Fase 5** | Migração Stages        | 44-66 horas      | 🟡 Média   |
| **Fase 6** | Testes                 | 10-16 horas      | 🟡 Média   |
| **Total**  |                        | **71-107 horas** |            |

**Nota**: Fase 5 pode ser paralelizada (múltiplos devs trabalhando em stages diferentes)

---

## 🎯 Ordem de Implementação Recomendada

### Sprint 1 (Fundação)

1. ✅ Fase 1: Fundação (Abstrações Base)
2. ✅ Fase 2: Pipeline Executor (básico, sem persistência)
3. ✅ Migrar 1-2 stages leves como POC

### Sprint 2 (Persistência e Eventos)

1. ✅ Fase 3: Persistência de Estado
2. ✅ Fase 4: Event Handlers Genéricos
3. ✅ Migrar 1 stage pesado como POC

### Sprint 3 (Migração Completa)

1. ✅ Migrar todos stages leves restantes
2. ✅ Migrar todos stages pesados restantes
3. ✅ Testes de integração

### Sprint 4 (Validação e Refinamento)

1. ✅ Testes end-to-end
2. ✅ Ajustes e refinamentos
3. ✅ Documentação

---

## 🚀 Próximos Passos Imediatos

### 1. Criar Estrutura de Arquivos

```bash
mkdir -p src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/base
mkdir -p src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/light
mkdir -p src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/heavy
mkdir -p src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/pipeline
mkdir -p src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/handlers
```

### 2. Começar Fase 1

**Primeira tarefa**: Criar interfaces base (`stage.interface.ts`, `heavy-stage.interface.ts`, `base-stage.abstract.ts`)

### 3. Atualizar Spec

**Arquivo**: `specs/001-workflow-queue/spec.md`

**Adicionar seção sobre**:

- Arquitetura de Pipeline com Stages Isolados
- Persistência de Estado
- Event Handlers Genéricos

---

## 📝 Checklist de Validação

Antes de considerar completo, validar:

- [ ] Todos stages implementam `Stage` ou `HeavyStage`
- [ ] Pipeline executa stages sequencialmente
- [ ] Stages pesados pausam workflow e retomam quando evento chega
- [ ] Estado é persistido após cada stage
- [ ] Pipeline pode retomar após worker crashar
- [ ] Compensação funciona em caso de falha
- [ ] Testes unitários para cada stage
- [ ] Testes de integração do pipeline completo
- [ ] Documentação atualizada

---

## 🎯 Decisões Pendentes

1. **Persistência de Estado**: Usar `WorkflowJob` existente ou tabela separada?
2. **Eventos**: Usar RabbitMQ events ou sistema próprio?
3. **Retry**: Retry automático por stage ou apenas no workflow?
4. **Compensação**: Todos stages precisam compensação ou apenas alguns?

**Recomendação**: Decidir antes de começar Fase 3 e 4.
