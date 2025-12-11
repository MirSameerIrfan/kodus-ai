import { createLogger } from '@kodus/flow';
import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { DurablePipelineExecutor } from '@libs/core/workflow/engine/executor/durable-pipeline-executor.service';
import { JobStatus } from '@libs/core/workflow/domain/enums/job-status.enum';
import {
    WORKFLOW_JOB_REPOSITORY_TOKEN,
    IWorkflowJobRepository,
} from '@libs/core/workflow/domain/contracts/workflow-job.repository.contract';
import { CodeReviewPipelineContext } from '../pipeline/context/code-review-pipeline.context';
import { CodeReviewPipelineStrategyEE } from '@libs/ee/codeReview/strategies/code-review-pipeline.strategy.ee';
import { IJobProcessorService } from '@libs/core/workflow/domain/contracts/job-processor.service.contract';
import { ErrorClassification } from '@libs/core/workflow/domain/enums/error-classification.enum';

@Injectable()
export class CodeReviewJobProcessorService implements IJobProcessorService {
    private readonly logger = createLogger(CodeReviewJobProcessorService.name);

    constructor(
        private readonly pipelineExecutor: DurablePipelineExecutor,
        @Inject(WORKFLOW_JOB_REPOSITORY_TOKEN)
        private readonly jobRepository: IWorkflowJobRepository,
        private readonly pipelineStrategy: CodeReviewPipelineStrategyEE,
    ) {}

    async process(jobId: string): Promise<void> {
        const job = await this.jobRepository.findOne(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }

        const correlationId = job.correlationId || uuidv4();

        this.logger.log({
            message: `Processing Code Review Job ${jobId}`,
            context: CodeReviewJobProcessorService.name,
            metadata: { jobId, correlationId },
        });

        try {
            await this.jobRepository.update(jobId, {
                status: JobStatus.PROCESSING,
                startedAt: new Date(),
            });

            // Build context from job payload
            // This assumes job.payload matches what CodeReviewPipelineContext expects
            // or we need a mapper here.
            const payload = job.payload || {};

            const context: CodeReviewPipelineContext = {
                ...payload,
                workflowJobId: jobId,
                correlationId,
                // Ensure required fields
                tasks: payload.tasks || {},
            };

            const stages = this.pipelineStrategy.configureStages();

            await this.pipelineExecutor.execute(context, stages, jobId);

            await this.markCompleted(jobId);

            this.logger.log({
                message: `Job ${jobId} completed successfully`,
                context: CodeReviewJobProcessorService.name,
            });
        } catch (error) {
            if (error.name === 'WorkflowPausedError') {
                // Pipeline paused (async stage), status is already updated by Executor usually,
                // or we update it here if executor throws.
                // Assuming Executor throws WorkflowPausedError to signal pause.
                await this.jobRepository.update(jobId, {
                    status: JobStatus.WAITING_FOR_EVENT,
                    waitingForEvent: {
                        eventType: error.eventType,
                        eventKey: error.eventKey,
                    },
                });
                return;
            }

            this.logger.error({
                message: `Job ${jobId} failed`,
                error,
                context: CodeReviewJobProcessorService.name,
            });

            await this.handleFailure(jobId, error);
            throw error; // Re-throw to ensure caller knows it failed
        }
    }

    async handleFailure(jobId: string, error: Error): Promise<void> {
            await this.jobRepository.update(jobId, {
                status: JobStatus.FAILED,
            errorClassification: ErrorClassification.PERMANENT, // Or determine based on error
            lastError: error.message,
                failedAt: new Date(),
            });
        }

    async markCompleted(jobId: string, result?: unknown): Promise<void> {
        await this.jobRepository.update(jobId, {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            result: result,
        });
    }
}
