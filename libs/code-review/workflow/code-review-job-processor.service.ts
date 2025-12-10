import { RabbitSubscribe, AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { createLogger } from '@kodus/flow';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { DurablePipelineExecutor } from '@libs/core/workflow/engine/executor/durable-pipeline-executor.service';
import { JobStatus } from '@libs/core/workflow/domain/enums/job-status.enum';
import {
    WORKFLOW_JOB_REPOSITORY_TOKEN,
    IWorkflowJobRepository,
} from '@libs/core/workflow/domain/contracts/workflow-job.repository.contract';
import { CodeReviewPipelineContext } from '../pipeline/context/code-review-pipeline.context';
import { CodeReviewPipelineStrategyEE } from '@libs/ee/codeReview/strategies/code-review-pipeline.strategy.ee';

@Injectable()
export class CodeReviewJobProcessorService {
    private readonly logger = createLogger(CodeReviewJobProcessorService.name);

    constructor(
        private readonly pipelineExecutor: DurablePipelineExecutor,
        @Inject(WORKFLOW_JOB_REPOSITORY_TOKEN)
        private readonly jobRepository: IWorkflowJobRepository,
        private readonly pipelineStrategy: CodeReviewPipelineStrategyEE,
        @Optional()
        private readonly amqpConnection?: AmqpConnection,
    ) {}

    @RabbitSubscribe({
        exchange: 'workflow.exchange',
        routingKey: 'workflow.jobs.code_review',
        queue: 'workflow.jobs.code_review',
        queueOptions: {
            durable: true,
            arguments: {
                'x-queue-type': 'quorum',
            },
        },
    })
    async process(msg: any, amqpMsg: any): Promise<void> {
        const jobId = msg.jobId;
        const correlationId = msg.correlationId || uuidv4();

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

            // Build initial context (this logic depends on what is in the msg)
            // Assuming msg.payload contains the necessary data to build context
            // Or we load it from DB if the job payload has it.
            const job = await this.jobRepository.findOne(jobId);
            const payload = job.payload;

            // Map payload to Context
            // This mapping logic needs to be accurate to your system.
            // I'll assume a helper or direct mapping.
            const context: CodeReviewPipelineContext = {
                ...payload, // simplified
                workflowJobId: jobId,
                correlationId,
                // Initialize other required fields
                tasks: {},
            };

            const stages = this.pipelineStrategy.configureStages();

            await this.pipelineExecutor.execute(context, stages, jobId);

            await this.jobRepository.update(jobId, {
                status: JobStatus.COMPLETED,
                completedAt: new Date(),
            });

            this.logger.log({
                message: `Job ${jobId} completed successfully`,
                context: CodeReviewJobProcessorService.name,
            });
        } catch (error) {
            // Error handling logic (Retry, Fail, etc.)
            // Note: DurablePipelineExecutor handles "WorkflowPausedError" by saving state and throwing.
            // We should catch it here to update job status to WAITING_FOR_EVENT if not already handled?
            // The Executor re-throws WorkflowPausedError.

            if (error.name === 'WorkflowPausedError') {
                await this.jobRepository.update(jobId, {
                    status: JobStatus.WAITING_FOR_EVENT,
                    waitingForEvent: {
                        eventType: error.eventType,
                        eventKey: error.eventKey,
                    },
                });
                return; // Stop processing, don't Ack/Nack in a way that requeues immediately?
                // RabbitSubscribe usually Acks on success. If we return, it Acks.
                // Since we saved state and set status to WAITING, we are "done" with this execution attempt.
            }

            this.logger.error({
                message: `Job ${jobId} failed`,
                error,
                context: CodeReviewJobProcessorService.name,
            });

            await this.jobRepository.update(jobId, {
                status: JobStatus.FAILED,
                error: error.message,
                failedAt: new Date(),
            });
        }
    }
}
