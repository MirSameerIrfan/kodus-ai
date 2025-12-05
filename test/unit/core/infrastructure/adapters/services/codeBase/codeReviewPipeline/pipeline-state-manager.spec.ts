import { Test, TestingModule } from '@nestjs/testing';
import { PipelineStateManager } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/pipeline/pipeline-state-manager.service';
import { WorkflowJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/workflow-job.repository';
import { CodeReviewPipelineContext } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context';
import { IWorkflowJob } from '@/core/domain/workflowQueue/interfaces/workflow-job.interface';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';

describe('PipelineStateManager', () => {
    let stateManager: PipelineStateManager;
    let workflowJobRepository: jest.Mocked<WorkflowJobRepository>;

    const createMockContext = (): CodeReviewPipelineContext => {
        return {
            correlationId: 'test-correlation-id',
            workflowJobId: 'test-workflow-job-id',
            currentStage: 'TestStage',
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
    };

    beforeEach(async () => {
        const mockRepository = {
            updatePipelineState: jest.fn().mockResolvedValue(undefined),
            findOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PipelineStateManager,
                {
                    provide: WorkflowJobRepository,
                    useValue: mockRepository,
                },
            ],
        }).compile();

        stateManager = module.get<PipelineStateManager>(PipelineStateManager);
        workflowJobRepository = module.get(WorkflowJobRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('saveState', () => {
        it('should save pipeline state to workflow job', async () => {
            const context = createMockContext();
            const workflowJobId = 'workflow-job-123';

            await stateManager.saveState(workflowJobId, context);

            expect(workflowJobRepository.updatePipelineState).toHaveBeenCalledWith(
                workflowJobId,
                expect.objectContaining({
                    correlationId: context.correlationId,
                    workflowJobId: context.workflowJobId,
                    currentStage: context.currentStage,
                }),
            );
            // Logger uses createLogger, so we can't easily mock it
            // Just verify the state was saved
        });

        it('should handle errors when saving state', async () => {
            const context = createMockContext();
            const workflowJobId = 'workflow-job-123';
            const error = new Error('Database error');
            workflowJobRepository.updatePipelineState.mockRejectedValue(error);

            await expect(stateManager.saveState(workflowJobId, context)).rejects.toThrow(
                'Database error',
            );

            // Logger uses createLogger, so we can't easily mock it
            // Just verify the error was thrown
        });
    });

    describe('resumeFromState', () => {
        it('should resume context from saved state', async () => {
            const workflowJobId = 'workflow-job-123';
            const savedState = {
                correlationId: 'test-correlation-id',
                workflowJobId: 'test-workflow-job-id',
                currentStage: 'TestStage',
                organizationAndTeamData: {
                    organizationId: 'org-1',
                    teamId: 'team-1',
                },
            };

            const mockJob: IWorkflowJob = {
                id: workflowJobId,
                uuid: workflowJobId,
                status: JobStatus.PROCESSING,
                pipelineState: savedState,
            } as IWorkflowJob;

            workflowJobRepository.findOne.mockResolvedValue(mockJob);

            const context = await stateManager.resumeFromState(workflowJobId);

            expect(context).toBeDefined();
            expect(context?.correlationId).toBe('test-correlation-id');
            expect(context?.currentStage).toBe('TestStage');
            // Logger uses createLogger, so we can't easily mock it
            // Just verify the context was resumed
        });

        it('should return null if job not found', async () => {
            const workflowJobId = 'non-existent-job';
            workflowJobRepository.findOne.mockResolvedValue(null);

            const context = await stateManager.resumeFromState(workflowJobId);

            expect(context).toBeNull();
            // Logger uses createLogger, so we can't easily mock it
            // Just verify null was returned
        });

        it('should return null if pipelineState is missing', async () => {
            const workflowJobId = 'workflow-job-123';
            const mockJob: IWorkflowJob = {
                id: workflowJobId,
                uuid: workflowJobId,
                status: JobStatus.PROCESSING,
                pipelineState: undefined,
            } as IWorkflowJob;

            workflowJobRepository.findOne.mockResolvedValue(mockJob);

            const context = await stateManager.resumeFromState(workflowJobId);

            expect(context).toBeNull();
            // Logger uses createLogger, so we can't easily mock it
            // Just verify null was returned
        });

        it('should handle errors when resuming state', async () => {
            const workflowJobId = 'workflow-job-123';
            const error = new Error('Database error');
            workflowJobRepository.findOne.mockRejectedValue(error);

            await expect(stateManager.resumeFromState(workflowJobId)).rejects.toThrow(
                'Database error',
            );

            // Logger uses createLogger, so we can't easily mock it
            // Just verify the error was thrown
        });
    });

    describe('getState', () => {
        it('should get pipeline state from workflow job', async () => {
            const workflowJobId = 'workflow-job-123';
            const savedState = {
                correlationId: 'test-correlation-id',
                currentStage: 'TestStage',
            };

            const mockJob: IWorkflowJob = {
                id: workflowJobId,
                uuid: workflowJobId,
                status: JobStatus.PROCESSING,
                pipelineState: savedState,
            } as IWorkflowJob;

            workflowJobRepository.findOne.mockResolvedValue(mockJob);

            const state = await stateManager.getState(workflowJobId);

            expect(state).toEqual(savedState);
        });

        it('should return null if job not found', async () => {
            const workflowJobId = 'non-existent-job';
            workflowJobRepository.findOne.mockResolvedValue(null);

            const state = await stateManager.getState(workflowJobId);

            expect(state).toBeNull();
        });

        it('should handle errors when getting state', async () => {
            const workflowJobId = 'workflow-job-123';
            const error = new Error('Database error');
            workflowJobRepository.findOne.mockRejectedValue(error);

            await expect(stateManager.getState(workflowJobId)).rejects.toThrow('Database error');
        });
    });
});

