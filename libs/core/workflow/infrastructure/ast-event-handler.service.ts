import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, UseFilters } from '@nestjs/common';

import { RabbitmqConsumeErrorFilter } from '@libs/core/infrastructure/filters/rabbitmq-consume-error.exception';
import { createLogger } from '@kodus/flow';
import { JobStatus } from '@libs/core/workflow/domain/enums/job-status.enum';
import { ObservabilityService } from '@libs/core/log/observability.service';

import { WorkflowJobRepository } from './repositories/workflow-job.repository';

interface ASTCompletedMessage {
    taskId: string;
    result: Record<string, unknown>;
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class ASTEventHandler {
    private readonly logger = createLogger(ASTEventHandler.name);
    constructor(
        private readonly jobRepository: WorkflowJobRepository,
        private readonly amqpConnection: AmqpConnection,
        private readonly observability: ObservabilityService,
    ) {}

    @RabbitSubscribe({
        exchange: 'workflow.events',
        routingKey: 'ast.task.completed',
        queue: 'workflow.events.ast',
        allowNonJsonMessages: false,
        queueOptions: {
            durable: true,
            arguments: {
                'x-queue-type': 'quorum',
            },
        },
    })
    async handleASTCompleted(
        message: ASTCompletedMessage,
        amqpMsg: any,
    ): Promise<void> {
        const messageId = amqpMsg?.properties?.messageId;
        const correlationId =
            amqpMsg?.properties?.headers?.['x-correlation-id'] ||
            amqpMsg?.properties?.correlationId;

        return await this.observability.runInSpan(
            'workflow.event.ast.completed',
            async (span) => {
                span.setAttributes({
                    'workflow.event.type': 'ast.task.completed',
                    'workflow.event.task.id': message.taskId,
                    'workflow.correlation.id': correlationId,
                });

                this.logger.log({
                    message: 'Received AST completed event',
                    context: ASTEventHandler.name,
                    metadata: {
                        taskId: message.taskId,
                        messageId,
                        correlationId,
                    },
                });

                // Find workflows waiting for this AST task
                const waitingJobsResult = await this.jobRepository.findMany({
                    status: JobStatus.WAITING_FOR_EVENT,
                });

                const matchingJobs = waitingJobsResult.data.filter((job) => {
                    const waitingFor = job.waitingForEvent;
                    return (
                        waitingFor?.eventType === 'ast.task.completed' &&
                        waitingFor?.eventKey === message.taskId
                    );
                });

                if (matchingJobs.length === 0) {
                    this.logger.debug({
                        message: `No workflows found waiting for AST task ${message.taskId}`,
                        context: ASTEventHandler.name,
                        metadata: { taskId: message.taskId },
                    });
                    return;
                }

                this.logger.log({
                    message: `Found ${matchingJobs.length} workflow(s) waiting for AST task ${message.taskId}`,
                    context: ASTEventHandler.name,
                    metadata: {
                        taskId: message.taskId,
                        jobIds: matchingJobs.map((j) => j.id),
                    },
                });

                // Resume each matching workflow
                for (const job of matchingJobs) {
                    await this.resumeWorkflow(job.id, {
                        astResult: message.result,
                        taskId: message.taskId,
                    });
                }

                span.setAttributes({
                    'workflow.event.resumed_count': matchingJobs.length,
                });
            },
            {
                'workflow.component': 'event_handler',
                'workflow.operation': 'resume_workflow',
            },
        );
    }

    /**
     * Resumes a paused workflow with event data.
     * Updates job status to PENDING and enqueues for continued processing.
     */
    private async resumeWorkflow(
        jobId: string,
        eventData: { astResult: Record<string, unknown>; taskId: string },
    ): Promise<void> {
        const job = await this.jobRepository.findOne(jobId);
        if (!job) {
            this.logger.warn({
                message: `Job ${jobId} not found when trying to resume workflow`,
                context: ASTEventHandler.name,
                metadata: { jobId },
            });
            return;
        }

        // Update job to resume processing
        await this.jobRepository.update(jobId, {
            status: JobStatus.PENDING, // Back to queue
            waitingForEvent: undefined, // Clear waiting state
            metadata: {
                ...job.metadata,
                astResult: eventData.astResult, // Save AST result
                resumedAt: new Date(),
            },
        });

        // Enqueue job for continued processing
        await this.amqpConnection.publish(
            'workflow.exchange',
            'workflow.jobs.resumed',
            {
                jobId,
                eventData: eventData.astResult,
            },
            {
                messageId: `resume-${jobId}`,
                correlationId: job.correlationId,
                persistent: true,
                headers: {
                    'x-correlation-id': job.correlationId,
                    'x-workflow-type': job.workflowType,
                    'x-job-id': jobId,
                    'x-resume-reason': 'ast.completed',
                },
            },
        );

        this.logger.log({
            message: `Workflow ${jobId} resumed after AST completion`,
            context: ASTEventHandler.name,
            metadata: {
                jobId,
                correlationId: job.correlationId,
                taskId: eventData.taskId,
            },
        });
    }
}
