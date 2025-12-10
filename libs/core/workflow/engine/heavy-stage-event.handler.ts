import { RabbitSubscribe, AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { createLogger } from '@kodus/flow';
import { Injectable, Optional, Inject } from '@nestjs/common';

import { JobStatus } from '../../domain/enums/job-status.enum';
import { StageCompletedEvent } from '../../domain/interfaces/stage-completed-event.interface';
import { PipelineStateManager } from './state/pipeline-state-manager.service';
import { EventBufferService } from '../event-buffer.service';
import { ObservabilityService } from '@libs/log/observability.service';
import {
    WORKFLOW_JOB_REPOSITORY_TOKEN,
    IWorkflowJobRepository,
} from '../../domain/contracts/workflow-job.repository.contract';

/**
 * Generic handler for heavy stage completion events
 * Resumes paused workflows when events arrive
 */
@Injectable()
export class HeavyStageEventHandler {
    private readonly logger = createLogger(HeavyStageEventHandler.name);

    constructor(
        @Inject(WORKFLOW_JOB_REPOSITORY_TOKEN)
        private readonly jobRepository: IWorkflowJobRepository,
        private readonly stateManager: PipelineStateManager,
        private readonly eventBuffer: EventBufferService,
        private readonly observability: ObservabilityService,
        @Optional()
        private readonly amqpConnection?: AmqpConnection,
    ) {}

    /**
     * Handle stage completion event
     * Finds paused workflows waiting for this event and resumes them
     */
    @RabbitSubscribe({
        exchange: 'workflow.events',
        routingKey: 'stage.completed.*',
        queue: 'workflow.events.stage.completed',
        allowNonJsonMessages: false,
        queueOptions: {
            durable: true,
            arguments: {
                'x-queue-type': 'quorum',
            },
        },
    })
    async onStageCompleted(
        event: StageCompletedEvent,
        amqpMsg: any,
    ): Promise<void> {
        const messageId = amqpMsg?.properties?.messageId;
        const correlationId =
            amqpMsg?.properties?.headers?.['x-correlation-id'] ||
            amqpMsg?.properties?.correlationId;

        return await this.observability.runInSpan(
            'workflow.event.stage.completed',
            async (span) => {
                span.setAttributes({
                    'workflow.event.type': event.eventType,
                    'workflow.event.stage': event.stageName,
                    'workflow.event.task.id': event.taskId,
                    'workflow.correlation.id': correlationId,
                });

                this.logger.log({
                    message: `Received stage completion event: ${event.stageName}`,
                    context: HeavyStageEventHandler.name,
                    metadata: {
                        stageName: event.stageName,
                        eventType: event.eventType,
                        eventKey: event.eventKey,
                        taskId: event.taskId,
                        messageId,
                        correlationId,
                    },
                });

                // Find workflows waiting for this event
                const waitingJobs = await this.findWaitingWorkflows(
                    event.eventType,
                    event.eventKey,
                );

                if (waitingJobs.length === 0) {
                    // Store event in buffer for potential race conditions
                    await this.eventBuffer.store(
                        event.eventType,
                        event.eventKey,
                        event,
                    );
                    this.logger.warn({
                        message: `No workflows found waiting for event ${event.eventType} with key ${event.eventKey}`,
                        context: HeavyStageEventHandler.name,
                        metadata: {
                            eventType: event.eventType,
                            eventKey: event.eventKey,
                            taskId: event.taskId,
                        },
                    });
                    return;
                }

                // Resume each waiting workflow
                for (const job of waitingJobs) {
                    try {
                        await this.resumeWorkflow(job.id, event);
                    } catch (error) {
                        this.logger.error({
                            message: `Failed to resume workflow ${job.id}`,
                            context: HeavyStageEventHandler.name,
                            error: error instanceof Error ? error : undefined,
                            metadata: {
                                workflowJobId: job.id,
                                stageName: event.stageName,
                                eventType: event.eventType,
                                taskId: event.taskId,
                            },
                        });
                        // Continue with other workflows even if one fails
                    }
                }
            },
        );
    }

    /**
     * Find workflows waiting for a specific event
     */
    private async findWaitingWorkflows(eventType: string, eventKey: string) {
        const allWaitingJobs = await this.jobRepository.findMany({
            status: JobStatus.WAITING_FOR_EVENT,
            limit: 1000, // Reasonable limit
        });

        return allWaitingJobs.data.filter((job) => {
            const waitingFor = job.waitingForEvent;
            return (
                waitingFor?.eventType === eventType &&
                waitingFor?.eventKey === eventKey
            );
        });
    }

    /**
     * Resume a paused workflow
     * Updates job status and enqueues for continued processing via WorkflowResumedConsumer
     */
    private async resumeWorkflow(
        workflowJobId: string,
        event: StageCompletedEvent,
    ): Promise<void> {
        const job = await this.jobRepository.findOne(workflowJobId);
        if (!job) {
            this.logger.warn({
                message: `Job ${workflowJobId} not found when trying to resume workflow`,
                context: HeavyStageEventHandler.name,
                metadata: { workflowJobId },
            });
            return;
        }

        this.logger.log({
            message: `Resuming workflow ${workflowJobId} for stage ${event.stageName}`,
            context: HeavyStageEventHandler.name,
            metadata: {
                workflowJobId,
                stageName: event.stageName,
                eventType: event.eventType,
                taskId: event.taskId,
                correlationId: job.correlationId,
            },
        });

        // Update job to resume processing
        await this.jobRepository.update(workflowJobId, {
            status: JobStatus.PENDING, // Back to queue
            waitingForEvent: undefined, // Clear waiting state
            metadata: {
                ...job.metadata,
                stageCompletedEvent: {
                    stageName: event.stageName,
                    eventType: event.eventType,
                    eventKey: event.eventKey,
                    taskId: event.taskId,
                    result: event.result,
                },
                resumedAt: new Date(),
            },
        });

        // Enqueue job for continued processing via WorkflowResumedConsumer
        if (!this.amqpConnection) {
            this.logger.error({
                message: `Cannot enqueue resumed workflow ${workflowJobId}: RabbitMQ not available`,
                context: HeavyStageEventHandler.name,
                metadata: { workflowJobId },
            });
            throw new Error('RabbitMQ connection not available');
        }

        await this.amqpConnection.publish(
            'workflow.exchange',
            'workflow.jobs.resumed',
            {
                jobId: workflowJobId,
                eventData: {
                    stageName: event.stageName,
                    eventType: event.eventType,
                    taskId: event.taskId,
                    result: event.result,
                },
            },
            {
                messageId: `resume-${workflowJobId}-${event.eventType}-${event.taskId}`,
                correlationId: job.correlationId,
                persistent: true,
                headers: {
                    'x-correlation-id': job.correlationId,
                    'x-workflow-type': job.workflowType,
                    'x-job-id': workflowJobId,
                    'x-resume-reason': event.eventType,
                    'x-stage-name': event.stageName,
                },
            },
        );

        this.logger.log({
            message: `Workflow ${workflowJobId} enqueued for resume after ${event.stageName} completion`,
            context: HeavyStageEventHandler.name,
            metadata: {
                workflowJobId,
                stageName: event.stageName,
                correlationId: job.correlationId,
                taskId: event.taskId,
            },
        });
    }
}
