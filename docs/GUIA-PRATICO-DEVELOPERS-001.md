# Guia Prático para Desenvolvedores: 001-workflow-queue

**Data**: 2025-01-27  
**Público**: Desenvolvedores da equipe

---

## 🎯 Quick Start

### Como Funciona em 30 Segundos

1. **Webhook chega** → `WebhookProcessingJobProcessor` processa e enfileira `CODE_REVIEW` job
2. **Worker pega job** → `CodeReviewJobProcessor` cria contexto e chama `PipelineExecutor`
3. **Pipeline executa stages** → Light stages executam rápido, heavy stages pausam workflow
4. **Heavy stage completa** → Publica evento, `HeavyStageEventHandler` retoma workflow
5. **Pipeline continua** → Executa stages restantes e completa

---

## 📝 Exemplos Práticos

### Exemplo 1: Adicionar um Novo Light Stage

**Cenário**: Criar um stage que valida se o PR tem testes.

```typescript
// src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/validate-tests.stage.ts
import { Injectable } from '@nestjs/common';
import { BaseStage } from '../base/base-stage.abstract';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import { AutomationStatus } from '@/core/domain/automation/enums/automation-status';

@Injectable()
export class ValidateTestsStage extends BaseStage {
    name = 'ValidateTestsStage';
    dependsOn: string[] = ['FetchChangedFilesStage']; // Executa após buscar arquivos

    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        const hasTests = context.changedFiles?.some(file => 
            file.filename.includes('.test.') || 
            file.filename.includes('.spec.')
        );

        if (!hasTests) {
            return this.updateContext(context, (draft) => {
                draft.statusInfo = {
                    status: AutomationStatus.SKIPPED,
                    message: 'No tests found in PR',
                };
            });
        }

        return this.updateContext(context, (draft) => {
            draft.hasTests = true;
        });
    }
}
```

**Registrar no módulo**:
```typescript
// src/modules/codeReviewPipeline.module.ts
providers: [
    // ... outros
    ValidateTestsStage,
],
```

**Adicionar ao strategy**:
```typescript
// src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/strategies/code-review-pipeline.strategy.ts
configureStages(): Stage[] {
    return [
        // ... outros
        this.fetchChangedFilesStage,
        this.validateTestsStage, // Adicionar aqui
        // ... outros
    ];
}
```

---

### Exemplo 2: Adicionar um Novo Heavy Stage

**Cenário**: Criar um stage que faz análise de segurança via API externa.

```typescript
// src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/security-analysis.stage.ts
import { Injectable, Inject } from '@nestjs/common';
import { BaseStage } from '../base/base-stage.abstract';
import { HeavyStage } from '../base/heavy-stage.interface';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import { EventType } from '@/core/domain/workflowQueue/enums/event-type.enum';
import { WorkflowPausedError } from '@/core/domain/workflowQueue/errors/workflow-paused.error';
import { v4 as uuidv4 } from 'uuid';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class SecurityAnalysisStage extends BaseStage implements HeavyStage {
    name = 'SecurityAnalysisStage';
    dependsOn: string[] = ['FileAnalysisStage'];
    timeout = 15 * 60 * 1000; // 15 minutos
    eventType = EventType.SECURITY_ANALYSIS_COMPLETED; // Adicionar ao enum

    constructor(
        @Inject('SECURITY_API_SERVICE')
        private readonly securityApiService: SecurityApiService,
        private readonly amqpConnection: AmqpConnection,
    ) {
        super();
    }

    isLight(): boolean {
        return false;
    }

    async start(context: CodeReviewPipelineContext): Promise<string> {
        const taskId = uuidv4();
        
        // Inicia análise assíncrona na API externa
        await this.securityApiService.startAnalysis({
            taskId,
            files: context.changedFiles.map(f => ({
                path: f.filename,
                content: f.patchWithLinesStr,
            })),
        });

        // Armazena taskId no contexto para recuperar depois
        context = this.updateContext(context, (draft) => {
            if (!draft.tasks) draft.tasks = {};
            draft.tasks.securityAnalysis = { taskId };
        });

        return taskId;
    }

    async getResult(
        context: CodeReviewPipelineContext,
        taskId: string,
    ): Promise<CodeReviewPipelineContext> {
        // Busca resultado da análise
        const result = await this.securityApiService.getAnalysisResult(taskId);
        
        return this.updateContext(context, (draft) => {
            if (!draft.tasks) draft.tasks = {};
            draft.tasks.securityAnalysis = {
                taskId,
                result: result.vulnerabilities,
            };
        });
    }

    async resume(
        context: CodeReviewPipelineContext,
        taskId: string,
    ): Promise<CodeReviewPipelineContext> {
        // Processa resultado e atualiza contexto
        const analysisResult = context.tasks?.securityAnalysis?.result;
        
        if (analysisResult?.length > 0) {
            return this.updateContext(context, (draft) => {
                draft.securityIssues = analysisResult;
            });
        }

        return context;
    }

    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        const taskId = await this.start(context);
        
        // Lança erro para pausar workflow
        throw new WorkflowPausedError(
            this.eventType,
            taskId,
            this.name,
            taskId,
            this.timeout,
            {
                workflowJobId: context.workflowJobId,
                correlationId: context.correlationId,
            },
        );
    }
}
```

**Publicar evento quando análise completar** (no serviço externo ou webhook):
```typescript
// Quando a API externa completar a análise
await this.amqpConnection.publish(
    'workflow.events',
    'stage.completed.security.analysis',
    {
        stageName: 'SecurityAnalysisStage',
        eventType: EventType.SECURITY_ANALYSIS_COMPLETED,
        eventKey: taskId,
        taskId: taskId,
        result: {
            vulnerabilities: [...],
        },
        workflowJobId: context.workflowJobId,
        correlationId: context.correlationId,
    },
    {
        messageId: `security-analysis-${taskId}`,
        correlationId: context.correlationId,
        persistent: true,
    },
);
```

**Adicionar EventType ao enum**:
```typescript
// src/core/domain/workflowQueue/enums/event-type.enum.ts
export enum EventType {
    // ... existentes
    SECURITY_ANALYSIS_COMPLETED = 'security.analysis.completed',
}
```

---

### Exemplo 3: Debugging um Job Pausado

**Cenário**: Um job está pausado e você precisa investigar por quê.

```typescript
// Script de debug
async function debugJob(jobId: string) {
    const job = await workflowJobRepository.findOne(jobId);
    
    console.log('=== Job Info ===');
    console.log('ID:', job.id);
    console.log('Status:', job.status);
    console.log('Workflow Type:', job.workflowType);
    console.log('Correlation ID:', job.correlationId);
    
    console.log('\n=== Waiting For Event ===');
    console.log(JSON.stringify(job.waitingForEvent, null, 2));
    
    console.log('\n=== Pipeline State ===');
    console.log('Current Stage:', job.pipelineState?.currentStage);
    console.log('Full State:', JSON.stringify(job.pipelineState, null, 2));
    
    console.log('\n=== Metadata ===');
    console.log(JSON.stringify(job.metadata, null, 2));
    
    // Verificar se evento foi publicado
    console.log('\n=== Verificar Eventos ===');
    console.log('Procurar eventos com:');
    console.log('- eventType:', job.waitingForEvent?.eventType);
    console.log('- eventKey:', job.waitingForEvent?.eventKey);
}
```

**Query SQL para encontrar jobs pausados**:
```sql
SELECT 
    id,
    status,
    "waitingForEvent",
    "pipelineState"->>'currentStage' as current_stage,
    metadata->>'stageCompletedEvent' as completed_event,
    created_at,
    updated_at
FROM workflow.workflow_jobs
WHERE status = 'WAITING_FOR_EVENT'
ORDER BY updated_at DESC;
```

---

### Exemplo 4: Testar um Stage Localmente

**Cenário**: Você quer testar um stage sem executar o pipeline completo.

```typescript
// test/unit/stages/my-stage.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MyStage } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/my-stage.stage';
import { CodeReviewPipelineContext } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context';

describe('MyStage', () => {
    let stage: MyStage;
    let mockDependency: MockDependency;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MyStage,
                {
                    provide: 'DEPENDENCY_TOKEN',
                    useValue: createMockDependency(),
                },
            ],
        }).compile();

        stage = module.get<MyStage>(MyStage);
        mockDependency = module.get('DEPENDENCY_TOKEN');
    });

    it('should execute successfully', async () => {
        const context = createMockContext();
        const result = await stage.execute(context);
        
        expect(result.myData).toBeDefined();
        expect(mockDependency.method).toHaveBeenCalled();
    });

    function createMockContext(): CodeReviewPipelineContext {
        return {
            correlationId: 'test-correlation-id',
            organizationAndTeamData: {
                organizationId: 'org-1',
                teamId: 'team-1',
            },
            repository: {
                id: 'repo-1',
                name: 'test-repo',
            },
            pullRequest: {
                number: 123,
            },
        } as CodeReviewPipelineContext;
    }
});
```

---

### Exemplo 5: Adicionar Compensação a um Stage

**Cenário**: Um stage cria comentários no PR. Se falhar, precisa remover os comentários.

```typescript
@Injectable()
export class CreateCommentsStage extends BaseStage {
    name = 'CreateCommentsStage';
    private createdCommentIds: string[] = [];

    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        // Cria comentários
        const comments = await this.codeManagementService.createComments(...);
        
        // Armazena IDs para compensação
        this.createdCommentIds = comments.map(c => c.id);
        
        return this.updateContext(context, (draft) => {
            draft.createdComments = comments;
        });
    }

    async compensate(
        context: CodeReviewPipelineContext,
    ): Promise<void> {
        // Remove comentários criados em caso de falha
        for (const commentId of this.createdCommentIds) {
            try {
                await this.codeManagementService.deleteComment(commentId);
            } catch (error) {
                this.logger.error({
                    message: `Failed to delete comment ${commentId} during compensation`,
                    error,
                });
            }
        }
        this.createdCommentIds = [];
    }
}
```

---

### Exemplo 6: Verificar Logs de um Job

**Cenário**: Você precisa entender o que aconteceu com um job específico.

```typescript
// Buscar logs por correlationId
async function getJobLogs(correlationId: string) {
    // Logs estruturados incluem correlationId
    // Filtrar logs do sistema:
    
    // 1. Logs do CodeReviewJobProcessor
    // grep "correlationId.*${correlationId}" | grep "CodeReviewJobProcessor"
    
    // 2. Logs do PipelineExecutor
    // grep "correlationId.*${correlationId}" | grep "PipelineExecutor"
    
    // 3. Logs dos Stages
    // grep "correlationId.*${correlationId}" | grep "Stage"
    
    // 4. Logs do HeavyStageEventHandler
    // grep "correlationId.*${correlationId}" | grep "HeavyStageEventHandler"
}
```

**Estrutura de logs esperada**:
```json
{
    "message": "Processing code review job",
    "context": "CodeReviewJobProcessorService",
    "metadata": {
        "jobId": "job-123",
        "correlationId": "corr-456",
        "workflowType": "CODE_REVIEW"
    }
}
```

---

### Exemplo 7: Retomar um Job Manualmente

**Cenário**: Um job ficou pausado e o evento nunca chegou. Você quer retomar manualmente.

```typescript
// Script para retomar job manualmente
async function manuallyResumeJob(jobId: string, taskId: string) {
    const job = await workflowJobRepository.findOne(jobId);
    
    if (job.status !== JobStatus.WAITING_FOR_EVENT) {
        throw new Error(`Job ${jobId} is not in WAITING_FOR_EVENT status`);
    }
    
    // Publicar evento manualmente
    await amqpConnection.publish(
        'workflow.events',
        `stage.completed.${job.waitingForEvent.eventType}`,
        {
            stageName: job.pipelineState?.currentStage,
            eventType: job.waitingForEvent.eventType,
            eventKey: job.waitingForEvent.eventKey,
            taskId: taskId,
            result: {},
            workflowJobId: jobId,
            correlationId: job.correlationId,
        },
        {
            messageId: `manual-resume-${jobId}`,
            correlationId: job.correlationId,
            persistent: true,
        },
    );
    
    console.log(`Job ${jobId} manually resumed`);
}
```

---

## 🔍 Troubleshooting Comum

### Problema 1: Job Ficou Pausado e Não Retomou

**Sintomas**:
- Job com status `WAITING_FOR_EVENT`
- Evento deveria ter chegado mas não chegou

**Solução**:
1. Verificar se evento foi publicado:
   ```bash
   # Verificar logs do stage que deveria publicar
   grep "stage.completed" logs/app.log
   ```

2. Verificar se `HeavyStageEventHandler` está escutando:
   ```bash
   # Verificar logs do handler
   grep "HeavyStageEventHandler" logs/app.log
   ```

3. Verificar matching de eventos:
   ```typescript
   // eventType e eventKey devem corresponder EXATAMENTE
   // job.waitingForEvent.eventType === event.eventType
   // job.waitingForEvent.eventKey === event.eventKey
   ```

4. Retomar manualmente (ver Exemplo 7)

---

### Problema 2: Estado Perdido Após Crash

**Sintomas**:
- Job não retoma após restart
- `pipelineState` está null ou vazio

**Solução**:
1. Verificar se `PipelineStateManager` está salvando:
   ```typescript
   // Verificar logs de saveState
   grep "Pipeline state saved" logs/app.log
   ```

2. Verificar se `workflowJobId` está presente no contexto:
   ```typescript
   // O executor só salva se workflowJobId estiver presente
   if (this.stateManager && workflowJobId) {
       await this.stateManager.saveState(workflowJobId, context);
   }
   ```

3. Verificar se job foi criado corretamente:
   ```sql
   SELECT id, "pipelineState" FROM workflow.workflow_jobs WHERE id = 'job-id';
   ```

---

### Problema 3: Stage Não Executa na Ordem Correta

**Sintomas**:
- Stages executam fora de ordem
- Dependências não são respeitadas

**Solução**:
1. Verificar `dependsOn`:
   ```typescript
   // Stage deve ter dependsOn correto
   dependsOn: string[] = ['PreviousStage'];
   ```

2. Verificar ordem no strategy:
   ```typescript
   // Stages devem estar na ordem correta
   configureStages(): Stage[] {
       return [
           this.stage1, // Sem dependências primeiro
           this.stage2, // Que depende de stage1
       ];
   }
   ```

3. Verificar logs de execução:
   ```bash
   grep "Starting pipeline execution" logs/app.log
   grep "Executing stage" logs/app.log
   ```

---

## 📚 Referências Rápidas

### Interfaces Principais

```typescript
// Stage básico
interface Stage {
    name: string;
    dependsOn?: string[];
    execute(context: CodeReviewPipelineContext): Promise<CodeReviewPipelineContext>;
    isLight(): boolean;
    canExecute?(context: CodeReviewPipelineContext): Promise<boolean> | boolean;
    compensate?(context: CodeReviewPipelineContext): Promise<void>;
}

// Heavy stage
interface HeavyStage extends Stage {
    start(context: CodeReviewPipelineContext): Promise<string>;
    getResult(context: CodeReviewPipelineContext, taskId: string): Promise<CodeReviewPipelineContext>;
    resume(context: CodeReviewPipelineContext, taskId: string): Promise<CodeReviewPipelineContext>;
    timeout: number;
    eventType: string;
}
```

### Enums Importantes

```typescript
// Status do job
enum JobStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    WAITING_FOR_EVENT = 'WAITING_FOR_EVENT',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    RETRYING = 'RETRYING',
}

// Tipos de eventos
enum EventType {
    AST_ANALYSIS_COMPLETED = 'ast.task.completed',
    PR_LEVEL_REVIEW_COMPLETED = 'pr.level.review.completed',
    FILES_REVIEW_COMPLETED = 'files.review.completed',
    LLM_ANALYSIS_COMPLETED = 'llm.analysis.completed',
}
```

---

## 🎓 Checklist para Novos Desenvolvedores

- [ ] Entender diferença entre Workflow e Pipeline
- [ ] Entender diferença entre Light e Heavy Stages
- [ ] Saber como adicionar um novo stage
- [ ] Saber como debugar um job pausado
- [ ] Saber como testar um stage isoladamente
- [ ] Entender fluxo de pausa/resume
- [ ] Saber onde encontrar logs
- [ ] Entender estrutura de dados (WorkflowJob, PipelineState)

---

## 💡 Dicas

1. **Sempre use `updateContext()`**: Mantém imutabilidade do contexto
2. **Logs estruturados**: Sempre inclua `correlationId` nos logs
3. **Compensação**: Implemente `compensate()` para stages que criam recursos externos
4. **Dependências**: Defina `dependsOn` corretamente para garantir ordem
5. **Eventos**: Use `EventType` enum, não strings hardcoded
6. **Testes**: Teste stages isoladamente antes de integrar

---

## 📞 Suporte

- **Documentação Completa**: `docs/ARQUITETURA-001-WORKFLOW-QUEUE.md`
- **Diagramas**: `docs/DIAGRAMAS-ARQUITETURA-001.md`
- **Especificação**: `specs/001-workflow-queue/spec.md`
- **Revisão**: `docs/REVISAO-IMPLEMENTACAO-001-WORKFLOW-QUEUE.md`

