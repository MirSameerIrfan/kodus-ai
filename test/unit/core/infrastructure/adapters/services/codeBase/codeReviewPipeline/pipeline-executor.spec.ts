import { Test, TestingModule } from '@nestjs/testing';
import { CodeReviewPipelineExecutor } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/pipeline/pipeline-executor.service';
import { PipelineStateManager } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/pipeline/pipeline-state-manager.service';
import { CodeReviewPipelineContext } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context';
import { Stage } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/base/stage.interface';
import { HeavyStage } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/base/heavy-stage.interface';
import { WorkflowPausedError } from '@/core/domain/workflowQueue/errors/workflow-paused.error';
import { AutomationStatus } from '@/core/domain/automation/enums/automation-status';
import { EventType } from '@/core/domain/workflowQueue/enums/event-type.enum';

describe('CodeReviewPipelineExecutor', () => {
    let executor: CodeReviewPipelineExecutor;
    let stateManager: jest.Mocked<PipelineStateManager>;

    const createMockContext = (): CodeReviewPipelineContext => {
        return {
            correlationId: 'test-correlation-id',
            workflowJobId: 'test-workflow-job-id',
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
            statusInfo: {
                status: AutomationStatus.PENDING,
            },
        } as CodeReviewPipelineContext;
    };

    const createMockLightStage = (name: string, dependsOn: string[] = []): Stage => {
        return {
            name,
            dependsOn,
            isLight: () => true,
            execute: jest.fn().mockResolvedValue(createMockContext()),
        } as unknown as Stage;
    };

    const createMockHeavyStage = (name: string, dependsOn: string[] = []): HeavyStage => {
        return {
            name,
            dependsOn,
            isLight: () => false,
            timeout: 60000,
            eventType: EventType.FILES_REVIEW_COMPLETED,
            start: jest.fn().mockResolvedValue('task-id-123'),
            getResult: jest.fn().mockResolvedValue(createMockContext()),
            resume: jest.fn().mockResolvedValue(createMockContext()),
            execute: jest.fn().mockImplementation(() => {
                throw new WorkflowPausedError(
                    EventType.FILES_REVIEW_COMPLETED,
                    'task-id-123',
                    name,
                    'task-id-123',
                    60000,
                );
            }),
        } as unknown as HeavyStage;
    };

    beforeEach(async () => {
        const mockStateManager = {
            saveState: jest.fn().mockResolvedValue(undefined),
            resumeFromState: jest.fn(),
            getState: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CodeReviewPipelineExecutor,
                {
                    provide: PipelineStateManager,
                    useValue: mockStateManager,
                },
            ],
        }).compile();

        executor = module.get<CodeReviewPipelineExecutor>(CodeReviewPipelineExecutor);
        stateManager = module.get(PipelineStateManager);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('execute', () => {
        it('should execute light stages sequentially', async () => {
            const context = createMockContext();
            const stage1 = createMockLightStage('Stage1');
            const stage2 = createMockLightStage('Stage2', ['Stage1']);

            const result = await executor.execute(context, [stage1, stage2], 'workflow-id');

            expect(stage1.execute).toHaveBeenCalledTimes(1);
            expect(stage2.execute).toHaveBeenCalledTimes(1);
            expect(stateManager.saveState).toHaveBeenCalledTimes(3); // Initial + after each stage
        });

        it('should respect stage dependencies order', async () => {
            const context = createMockContext();
            const stage1 = createMockLightStage('Stage1');
            const stage2 = createMockLightStage('Stage2', ['Stage1']);
            const stage3 = createMockLightStage('Stage3', ['Stage2']);

            const executionOrder: string[] = [];
            jest.spyOn(stage1, 'execute').mockImplementation(async (ctx) => {
                executionOrder.push('Stage1');
                return ctx;
            });
            jest.spyOn(stage2, 'execute').mockImplementation(async (ctx) => {
                executionOrder.push('Stage2');
                return ctx;
            });
            jest.spyOn(stage3, 'execute').mockImplementation(async (ctx) => {
                executionOrder.push('Stage3');
                return ctx;
            });

            await executor.execute(context, [stage3, stage1, stage2], 'workflow-id');

            expect(executionOrder).toEqual(['Stage1', 'Stage2', 'Stage3']);
        });

        it('should pause workflow when heavy stage is encountered', async () => {
            const context = createMockContext();
            const lightStage = createMockLightStage('LightStage');
            const heavyStage = createMockHeavyStage('HeavyStage', ['LightStage']);

            await expect(
                executor.execute(context, [lightStage, heavyStage], 'workflow-id'),
            ).rejects.toThrow(WorkflowPausedError);

            expect(lightStage.execute).toHaveBeenCalledTimes(1);
            expect(heavyStage.start).toHaveBeenCalledTimes(1);
            expect(stateManager.saveState).toHaveBeenCalledTimes(2); // Initial + after light stage
        });

        it('should skip stages when canExecute returns false', async () => {
            const context = createMockContext();
            const stage1 = createMockLightStage('Stage1');
            const stage2 = createMockLightStage('Stage2', ['Stage1']);
            stage2.canExecute = jest.fn().mockReturnValue(false);

            await executor.execute(context, [stage1, stage2], 'workflow-id');

            expect(stage1.execute).toHaveBeenCalledTimes(1);
            expect(stage2.execute).not.toHaveBeenCalled();
        });

        it('should handle stage failures and call compensation', async () => {
            const context = createMockContext();
            const stage = createMockLightStage('Stage1');
            const error = new Error('Stage failed');
            stage.execute = jest.fn().mockRejectedValue(error);
            stage.compensate = jest.fn().mockResolvedValue(undefined);

            await expect(executor.execute(context, [stage], 'workflow-id')).rejects.toThrow(
                'Stage failed',
            );

            expect(stage.compensate).toHaveBeenCalledTimes(1);
        });

        it('should throw error if circular dependency detected', async () => {
            const context = createMockContext();
            const stage1 = createMockLightStage('Stage1', ['Stage2']);
            const stage2 = createMockLightStage('Stage2', ['Stage1']);

            await expect(executor.execute(context, [stage1, stage2], 'workflow-id')).rejects.toThrow(
                'Circular dependency',
            );
        });

        it('should skip pipeline if status is SKIPPED', async () => {
            const context = createMockContext();
            context.statusInfo = { status: AutomationStatus.SKIPPED };
            const stage1 = createMockLightStage('Stage1');
            const stage2 = createMockLightStage('Stage2', ['Stage1']);

            await executor.execute(context, [stage1, stage2], 'workflow-id');

            expect(stage1.execute).not.toHaveBeenCalled();
            expect(stage2.execute).not.toHaveBeenCalled();
        });
    });

    describe('resume', () => {
        it('should resume pipeline from heavy stage', async () => {
            const context = createMockContext();
            context.currentStage = 'HeavyStage';
            const heavyStage = createMockHeavyStage('HeavyStage');
            const nextStage = createMockLightStage('NextStage', ['HeavyStage']);

            const result = await executor.resume(
                context,
                [heavyStage, nextStage],
                'task-id-123',
                'workflow-id',
            );

            expect(heavyStage.getResult).toHaveBeenCalledWith(context, 'task-id-123');
            expect(heavyStage.resume).toHaveBeenCalledTimes(1);
            expect(nextStage.execute).toHaveBeenCalledTimes(1);
        });

        it('should throw error if currentStage not found', async () => {
            const context = createMockContext();
            context.currentStage = 'NonExistentStage';
            const stage = createMockLightStage('Stage1');

            await expect(
                executor.resume(context, [stage], 'task-id', 'workflow-id'),
            ).rejects.toThrow('Cannot resume: stage');
        });

        it('should throw error if trying to resume light stage', async () => {
            const context = createMockContext();
            context.currentStage = 'LightStage';
            const lightStage = createMockLightStage('LightStage');

            await expect(
                executor.resume(context, [lightStage], 'task-id', 'workflow-id'),
            ).rejects.toThrow('Cannot resume: stage');
        });
    });
});

