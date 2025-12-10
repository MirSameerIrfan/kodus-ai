import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { RabbitmqConsumeErrorFilter } from '@libs/core/infrastructure/filters/rabbitmq-consume-error.exception';
import { createLogger } from '@kodus/flow';
import { ProcessWorkflowJobUseCase } from '@libs/core/workflow/application/use-cases/process-workflow-job.use-case';
import { JobStatus } from '@libs/core/workflow/domain/enums/job-status.enum';

import { TransactionalInboxService } from './transactional-inbox.service';
import { ObservabilityService } from '@libs/core/log/observability.service';
import { WorkflowQueueConfig } from '@libs/core/infrastructure/config/types/general/workflow-queue.type';

interface WorkflowResumedMessage {
    jobId: string;
    eventData?: Record<string, unknown>;
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class WorkflowResumedConsumer {
    private readonly logger = createLogger(WorkflowResumedConsumer.name);
    private readonly workerEnabled: boolean;
    private readonly consumerId = 'workflow-resumed-consumer';

    constructor(
        private readonly processWorkflowJobUseCase: ProcessWorkflowJobUseCase,
        private readonly transactionalInboxService: TransactionalInboxService,
        private readonly jobRepository: WorkflowJobRepository,
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
        private readonly observability: ObservabilityService,
    ) {
        const workflowQueueConfig = this.configService.get<WorkflowQueueConfig>(
            'workflowQueueConfig',
        );
        this.workerEnabled = workflowQueueConfig.WORKFLOW_QUEUE_WORKER_ENABLED;
    }

    @RabbitSubscribe({
        exchange: 'workflow.exchange',
        routingKey: 'workflow.jobs.resumed',
        queue: 'workflow.jobs.resumed.queue',
        allowNonJsonMessages: false,
        queueOptions: {
            durable: true,
            arguments: {
                'x-queue-type': 'quorum',
                'x-dead-letter-exchange': 'workflow.exchange.dlx',
                'x-dead-letter-routing-key': 'workflow.jobs.dlq',
            },
        },
    })
    async handleWorkflowResumed(
        message: WorkflowResumedMessage,
        amqpMsg: any,
    ): Promise<void> {
        if (!this.workerEnabled) {
            this.logger.debug({
                message:
                    'Workflow worker is disabled, skipping resumed message processing.',
                context: WorkflowResumedConsumer.name,
                metadata: { messageId: amqpMsg?.properties?.messageId },
            });
            return;
        }

        const messageId = amqpMsg?.properties?.messageId;
        const correlationId =
            amqpMsg?.properties?.headers?.['x-correlation-id'] ||
            message.jobId ||
            amqpMsg?.properties?.correlationId;
        const jobId = message.jobId;

        if (!messageId || !jobId) {
            this.logger.error({
                message:
                    'Received resumed message without messageId or jobId. Cannot ensure idempotency.',
                context: WorkflowResumedConsumer.name,
                metadata: { message, amqpMsg, correlationId },
            });
            throw new Error(
                'Message without messageId or jobId cannot be processed idempotently.',
            );
        }

        this.observability.setContext({ correlationId });

        await this.dataSource.transaction(async (manager) => {
            const alreadyProcessed =
                await this.transactionalInboxService.isProcessedInTransaction(
                    manager,
                    messageId,
                    this.consumerId,
                );

            if (alreadyProcessed) {
                this.logger.log({
                    message: `Resumed message ${messageId} already processed by ${this.consumerId}. Skipping.`,
                    context: WorkflowResumedConsumer.name,
                    metadata: { messageId, correlationId, jobId },
                });
                return;
            }

            // Verify job is in WAITING_FOR_EVENT status
            const job = await this.jobRepository.findOne(jobId);
            if (!job) {
                this.logger.error({
                    message: `Job ${jobId} not found when trying to resume workflow`,
                    context: WorkflowResumedConsumer.name,
                    metadata: { jobId, correlationId, messageId },
                });
                throw new Error(`Job ${jobId} not found`);
            }

            if (job.status !== JobStatus.WAITING_FOR_EVENT) {
                this.logger.warn({
                    message: `Job ${jobId} is not in WAITING_FOR_EVENT status (current: ${job.status}). Skipping resume.`,
                    context: WorkflowResumedConsumer.name,
                    metadata: {
                        jobId,
                        correlationId,
                        messageId,
                        currentStatus: job.status,
                    },
                });
                // Mark as processed to avoid reprocessing
                await this.transactionalInboxService.markAsProcessedInTransaction(
                    manager,
                    messageId,
                    this.consumerId,
                );
                return;
            }

            this.logger.log({
                message: `Resuming workflow job ${jobId} after event`,
                context: WorkflowResumedConsumer.name,
                metadata: {
                    jobId,
                    correlationId,
                    messageId,
                    eventData: message.eventData,
                },
            });

            try {
                // Process the job (will continue from where it paused)
                await this.processWorkflowJobUseCase.execute({ jobId });

                await this.transactionalInboxService.markAsProcessedInTransaction(
                    manager,
                    messageId,
                    this.consumerId,
                );

                this.logger.log({
                    message: `Workflow job ${jobId} resumed and processed successfully`,
                    context: WorkflowResumedConsumer.name,
                    metadata: { jobId, correlationId, messageId },
                });
            } catch (error) {
                this.logger.error({
                    message: `Error resuming workflow job ${jobId}`,
                    context: WorkflowResumedConsumer.name,
                    error,
                    metadata: { jobId, correlationId, messageId },
                });
                throw error;
            }
        });
    }
}
