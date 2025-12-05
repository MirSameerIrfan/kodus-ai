# Arquitetura Ideal Balanceada: Responsabilidade Única + Fluxo Completo

**Data**: 2025-01-27  
**Objetivo**: Encontrar arquitetura que balanceia responsabilidade única por etapa, execução completa do fluxo, testabilidade, performance e manutenibilidade

---

## 🎯 Requisitos Críticos

1. **Responsabilidade Única**: Cada etapa é responsável por uma parte do review
2. **Fluxo Completo**: Não pode quebrar no meio, precisa chegar até o fim
3. **Testabilidade**: Fácil testar cada etapa isolada + fluxo completo
4. **Performance**: Não bloqueia worker, aproveita paralelismo
5. **Manutenibilidade**: Fácil adicionar/remover etapas

---

## 💡 Arquitetura Proposta: Pipeline com Stages Isolados + Garantias de Execução

### Conceito Central

**Pipeline = Orquestrador que Garante Execução Completa**

- Pipeline executa stages sequencialmente
- Pipeline gerencia estado e contexto
- Pipeline garante que fluxo chegue até o fim (ou falhe de forma controlada)

**Stage = Unidade Isolada com Responsabilidade Única**

- Cada stage tem uma responsabilidade clara
- Stage pode ser leve (rápido) ou pesado (event-driven)
- Stage é testável isoladamente
- Stage retorna contexto atualizado ou lança erro

**Garantias de Execução**:

- Pipeline executa stages até o fim (ou falha controlada)
- Se stage pesado falha, pipeline pode retry ou compensar
- Estado do pipeline é persistido (pode retomar se worker crashar)

---

## 🏗️ Arquitetura Detalhada

### 1. Pipeline Executor (Orquestrador)

**Responsabilidades**:

- Executa stages sequencialmente
- Gerencia contexto entre stages
- Garante execução completa (ou falha controlada)
- Persiste estado (para retomar se necessário)
- Gerencia retry e compensação

**Implementação**:

```typescript
class PipelineExecutor {
  async execute(
    stages: Stage[],
    context: PipelineContext
  ): Promise<PipelineContext> {
    // Persiste estado inicial
    await this.persistState(context);

    for (const stage of stages) {
      try {
        // Executa stage (pode pausar se for pesado)
        context = await this.executeStage(stage, context);

        // Persiste estado após cada stage
        await this.persistState(context);

      } catch (error) {
        if (error instanceof WorkflowPausedError) {
          // Stage pesado pausou - workflow será retomado quando evento chegar
          await this.pauseWorkflow(context, error);
          throw error; // Propaga para pausar workflow
        }

        // Erro real - tenta compensar ou marca como falha
        await this.handleStageFailure(stage, context, error);
        throw error;
      }
    }

    // Fluxo completo executado com sucesso
    return context;
  }

  async executeStage(
    stage: Stage,
    context: PipelineContext
  ): Promise<PipelineContext> {
    // Stage leve: executa diretamente
    if (stage.isLight()) {
      return await stage.execute(context);
    }

    // Stage pesado: event-driven
    return await this.executeHeavyStage(stage, context);
  }

  async executeHeavyStage(
    stage: HeavyStage,
    context: PipelineContext
  ): Promise<PipelineContext> {
    // Inicia stage pesado
    const taskId = await stage.start(context);

    // Publica evento e pausa workflow
    await this.pauseWorkflowForEvent({
      eventType: `${stage.name}.completed`,
      eventKey: taskId,
      timeout: stage.timeout
    });

    // Worker é liberado aqui
    throw new WorkflowPausedError(...);
  }
}
```

---

### 2. Stage Interface (Responsabilidade Única)

**Interface Base**:

```typescript
interface Stage {
    readonly name: string;
    readonly dependsOn?: string[]; // Dependências de outros stages

    // Executa stage e retorna contexto atualizado
    execute(context: PipelineContext): Promise<PipelineContext>;

    // Verifica se stage é leve ou pesado
    isLight(): boolean;

    // Valida se stage pode executar (opcional)
    canExecute?(context: PipelineContext): Promise<boolean>;

    // Compensação em caso de falha (opcional)
    compensate?(context: PipelineContext, error: Error): Promise<void>;
}
```

**Stage Leve** (executa diretamente):

```typescript
class ValidateNewCommitsStage implements Stage {
    readonly name = 'ValidateNewCommits';

    isLight(): boolean {
        return true; // Stage leve
    }

    async execute(context: PipelineContext): Promise<PipelineContext> {
        // Valida commits
        const hasNewCommits = await this.validateCommits(context);

        if (!hasNewCommits) {
            // Marca como skipped (não falha, apenas pula)
            return this.updateContext(context, { skipped: true });
        }

        return this.updateContext(context, { hasNewCommits: true });
    }
}
```

**Stage Pesado** (event-driven):

```typescript
class ProcessFilesReviewStage implements HeavyStage {
    readonly name = 'ProcessFilesReview';
    readonly dependsOn = ['PRLevelReviewStage'];

    isLight(): boolean {
        return false; // Stage pesado
    }

    async start(context: PipelineContext): Promise<string> {
        // Inicia análise LLM (não bloqueia)
        const taskId = uuid();
        await this.llmService.startAnalysis(taskId, context);
        return taskId;
    }

    async getResult(taskId: string): Promise<AnalysisResult> {
        // Busca resultado quando evento chegar
        return await this.llmService.getResult(taskId);
    }

    async execute(context: PipelineContext): Promise<PipelineContext> {
        // Este método NÃO é chamado diretamente para stages pesados
        // PipelineExecutor chama start() e pausa workflow
        throw new Error('HeavyStage should use start() + getResult()');
    }

    async resume(
        context: PipelineContext,
        result: AnalysisResult,
    ): Promise<PipelineContext> {
        // Retoma após evento chegar
        return this.updateContext(context, { analysisResult: result });
    }
}
```

---

### 3. Garantias de Execução Completa

**Persistência de Estado**:

```typescript
class PipelineStateManager {
    async persistState(context: PipelineContext): Promise<void> {
        // Salva estado do pipeline no banco
        await this.repository.save({
            workflowJobId: context.workflowJobId,
            currentStage: context.currentStage,
            context: context.serialize(),
            status: 'PROCESSING',
        });
    }

    async resumeFromState(workflowJobId: string): Promise<PipelineContext> {
        // Retoma pipeline do último estado salvo
        const state = await this.repository.findByWorkflowJobId(workflowJobId);
        return PipelineContext.deserialize(state.context);
    }
}
```

**Retry e Compensação**:

```typescript
class PipelineExecutor {
    async handleStageFailure(
        stage: Stage,
        context: PipelineContext,
        error: Error,
    ): Promise<void> {
        // Tenta compensar se stage tem método compensate
        if (stage.compensate) {
            try {
                await stage.compensate(context, error);
            } catch (compensationError) {
                // Log erro de compensação
                this.logger.error('Compensation failed', compensationError);
            }
        }

        // Marca workflow como FAILED
        await this.markWorkflowFailed(context.workflowJobId, error);
    }
}
```

**Event Handler para Retomar**:

```typescript
class HeavyStageEventHandler {
    async onStageCompleted(event: StageCompletedEvent): Promise<void> {
        // Encontra workflow pausado
        const pausedJob = await this.findPausedWorkflow({
            eventType: event.eventType,
            eventKey: event.taskId,
        });

        // Retoma pipeline do último estado
        const context = await this.pipelineStateManager.resumeFromState(
            pausedJob.id,
        );

        // Busca resultado do stage
        const stage = this.getStage(event.stageName);
        const result = await stage.getResult(event.taskId);

        // Retoma execução do pipeline
        await this.pipelineExecutor.resumeFromStage(stage, context, result);
    }
}
```

---

## ✅ Como Resolve Cada Requisito

### 1. Responsabilidade Única ✅

**Cada Stage tem uma responsabilidade clara**:

- `ValidateNewCommitsStage`: Valida commits
- `ProcessFilesPrLevelReviewStage`: Analisa PR-level
- `ProcessFilesReview`: Analisa arquivos
- `CreateCommentsStage`: Cria comentários

**Benefícios**:

- ✅ Fácil entender o que cada stage faz
- ✅ Fácil testar isoladamente
- ✅ Fácil manter (mudanças isoladas)

---

### 2. Fluxo Completo ✅

**Pipeline garante execução completa**:

- Pipeline executa stages sequencialmente
- Estado é persistido após cada stage
- Se worker crashar, pode retomar do último estado
- Se stage falhar, pipeline tenta compensar ou marca como FAILED

**Benefícios**:

- ✅ Fluxo não quebra no meio (ou falha de forma controlada)
- ✅ Estado persistido permite retomar
- ✅ Compensação permite rollback parcial

---

### 3. Testabilidade ✅

**Testes Unitários por Stage**:

```typescript
describe('ValidateNewCommitsStage', () => {
  it('should validate commits', async () => {
    const stage = new ValidateNewCommitsStage(...);
    const context = createMockContext();

    const result = await stage.execute(context);

    expect(result.hasNewCommits).toBe(true);
  });
});
```

**Testes de Integração do Pipeline**:

```typescript
describe('CodeReviewPipeline', () => {
    it('should execute complete flow', async () => {
        const pipeline = new PipelineExecutor();
        const stages = createStages();
        const context = createMockContext();

        // Mock stages pesados para não pausar
        mockHeavyStages(stages);

        const result = await pipeline.execute(stages, context);

        expect(result.status).toBe('COMPLETED');
        expect(result.comments).toHaveLength(5);
    });
});
```

**Testes de Stages Pesados**:

```typescript
describe('ProcessFilesReviewStage', () => {
  it('should start analysis and wait for event', async () => {
    const stage = new ProcessFilesReviewStage(...);
    const context = createMockContext();

    const taskId = await stage.start(context);

    expect(taskId).toBeDefined();
    // Verifica que análise foi iniciada
    expect(mockLLMService.startAnalysis).toHaveBeenCalled();
  });

  it('should resume with result', async () => {
    const stage = new ProcessFilesReviewStage(...);
    const context = createMockContext();
    const result = createMockResult();

    const updatedContext = await stage.resume(context, result);

    expect(updatedContext.analysisResult).toEqual(result);
  });
});
```

**Benefícios**:

- ✅ Cada stage é testável isoladamente
- ✅ Pipeline completo é testável (com mocks)
- ✅ Stages pesados são testáveis (start + resume)

---

### 4. Performance ✅

**Stages Leves**: Executam sequencialmente (rápido)

- Validações, queries rápidas
- Não bloqueiam worker

**Stages Pesados**: Event-driven (não bloqueiam)

- Publicam evento, pausam workflow
- Worker é liberado
- Quando evento chega, retoma execução

**Paralelismo**: Stages pesados podem rodar em paralelo

```typescript
// Inicia múltiplos stages pesados em paralelo
const prLevelTaskId = await prLevelStage.start(context);
const filesTaskId = await filesStage.start(context);

// Pausa workflow esperando ambos
await this.pauseWorkflowForEvents(
    [
        { eventType: 'pr.review.completed', eventKey: prLevelTaskId },
        { eventType: 'files.review.completed', eventKey: filesTaskId },
    ],
    { waitFor: 'all' },
);
```

**Benefícios**:

- ✅ Worker não bloqueia
- ✅ Stages pesados podem rodar em paralelo
- ✅ Stages leves executam rápido sequencialmente

---

### 5. Manutenibilidade ✅

**Adicionar Stage Leve**:

```typescript
// 1. Criar stage
class NewValidationStage implements Stage {
  readonly name = 'NewValidation';

  isLight(): boolean {
    return true;
  }

  async execute(context: PipelineContext): Promise<PipelineContext> {
    // Lógica do stage
    return this.updateContext(context, { ... });
  }
}

// 2. Adicionar no pipeline
const stages = [
  ...existingStages,
  new NewValidationStage(...),
  ...moreStages
];
```

**Adicionar Stage Pesado**:

```typescript
// 1. Criar stage pesado
class NewHeavyStage implements HeavyStage {
  readonly name = 'NewHeavyAnalysis';

  isLight(): boolean {
    return false;
  }

  async start(context: PipelineContext): Promise<string> {
    // Inicia análise
    return taskId;
  }

  async getResult(taskId: string): Promise<Result> {
    // Busca resultado
    return result;
  }

  async resume(context: PipelineContext, result: Result): Promise<PipelineContext> {
    // Retoma com resultado
    return this.updateContext(context, { result });
  }
}

// 2. Adicionar no pipeline
const stages = [
  ...existingStages,
  new NewHeavyStage(...),
  ...moreStages
];

// 3. Event handler já é genérico (não precisa criar novo)
```

**Benefícios**:

- ✅ Adicionar stage leve: Simples (criar classe, adicionar no array)
- ✅ Adicionar stage pesado: Simples (criar classe, adicionar no array, event handler é genérico)
- ✅ Remover stage: Simples (remover do array)
- ✅ Reordenar stages: Simples (reordenar array)

---

## 📊 Comparação com Outras Abordagens

| Requisito                  | Sequencial | Híbrido | Híbrido Balanceado |
| -------------------------- | ---------- | ------- | ------------------ |
| **Responsabilidade Única** | ✅         | ✅      | ✅                 |
| **Fluxo Completo**         | ✅         | ⚠️      | ✅                 |
| **Testabilidade**          | ✅         | ⚠️      | ✅                 |
| **Performance**            | ❌         | ✅      | ✅                 |
| **Manutenibilidade**       | ✅         | ⚠️      | ✅                 |

---

## 🎯 Implementação Recomendada

### Estrutura de Arquivos

```
src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/
├── pipeline/
│   ├── pipeline-executor.service.ts          # Orquestrador
│   ├── pipeline-state-manager.service.ts     # Persistência de estado
│   └── pipeline-context.ts                  # Contexto do pipeline
├── stages/
│   ├── base/
│   │   ├── stage.interface.ts               # Interface base
│   │   ├── heavy-stage.interface.ts          # Interface para stages pesados
│   │   └── base-stage.abstract.ts            # Classe base
│   ├── light/
│   │   ├── validate-new-commits.stage.ts
│   │   ├── resolve-config.stage.ts
│   │   └── ...
│   └── heavy/
│       ├── process-files-pr-level-review.stage.ts
│       ├── process-files-review.stage.ts
│       └── ...
├── handlers/
│   └── heavy-stage-event.handler.ts          # Handler genérico para stages pesados
└── strategies/
    └── code-review-pipeline.strategy.ts      # Configuração do pipeline
```

---

## 🎯 Conclusão

**Esta arquitetura resolve todos os requisitos**:

1. ✅ **Responsabilidade Única**: Cada stage tem uma responsabilidade clara
2. ✅ **Fluxo Completo**: Pipeline garante execução completa (ou falha controlada)
3. ✅ **Testabilidade**: Cada stage testável isoladamente + pipeline completo testável
4. ✅ **Performance**: Stages leves rápidos, stages pesados não bloqueiam
5. ✅ **Manutenibilidade**: Fácil adicionar/remover/reordenar stages

**Diferenciais**:

- ✅ Pipeline como orquestrador (garante execução completa)
- ✅ Stages isolados (responsabilidade única)
- ✅ Estado persistido (permite retomar)
- ✅ Event handler genérico (não precisa criar handler por stage)
- ✅ Abstrações claras (fácil adicionar stages)
