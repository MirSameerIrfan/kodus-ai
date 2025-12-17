import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Inject } from '@nestjs/common';
import { UseFilters } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

import { RabbitmqConsumeErrorFilter } from '@libs/core/infrastructure/filters/rabbitmq-consume-error.exception';
import { IJobProcessorService } from '@libs/core/workflow/domain/contracts/job-processor.service.contract';
import { JOB_PROCESSOR_SERVICE_TOKEN } from '@libs/core/workflow/domain/contracts/job-processor.service.contract';
import { MessagePayload } from '@libs/core/domain/contracts/message-broker.service.contracts';

import { ObservabilityService } from '@libs/core/log/observability.service';
import { createLogger } from '@kodus/flow';
import { InboxMessageRepository } from './repositories/inbox-message.repository';

interface WorkflowJobMessage {
    jobId: string;
    correlationId: string;
    [key: string]: unknown;
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class WorkflowJobConsumer {
    private readonly logger = createLogger(WorkflowJobConsumer.name);
    private readonly consumerId = 'workflow-job-consumer';

    constructor(
        @Inject(JOB_PROCESSOR_SERVICE_TOKEN)
        private readonly jobProcessor: IJobProcessorService,
        private readonly observability: ObservabilityService,
        private readonly inboxRepository: InboxMessageRepository,
    ) {}

    @RabbitSubscribe({
        exchange: 'workflow.exchange',
        routingKey: 'workflow.jobs.*',
        queue: 'workflow.jobs.queue',
        queueOptions: {
            durable: true,
            arguments: {
                'x-queue-type': 'quorum',
                'x-dead-letter-exchange': 'workflow.exchange.dlx',
                'x-dead-letter-routing-key': 'workflow.jobs.dlq',
            },
        },
    })
    async handleWorkflowJob(
        message: WorkflowJobMessage | MessagePayload<WorkflowJobMessage>,
        amqpMsg: ConsumeMessage,
    ): Promise<void> {
        // Unwrap message if it's in MessagePayload envelope
        const unwrappedMessage: WorkflowJobMessage = this.isMessagePayload(
            message,
        )
            ? message.payload
            : message;

        const messageId = amqpMsg.properties.messageId;
        // Extrai correlation ID dos headers primeiro, depois do payload, depois das properties
        const correlationId =
            (amqpMsg.properties.headers &&
                amqpMsg.properties.headers['x-correlation-id']) ||
            unwrappedMessage.correlationId ||
            amqpMsg.properties.correlationId;

        if (!messageId || !unwrappedMessage.jobId) {
            this.logger.error({
                message:
                    'Invalid workflow job message: missing messageId or jobId',
                context: WorkflowJobConsumer.name,
                metadata: {
                    message,
                    unwrappedMessage,
                    amqpMsg: {
                        messageId,
                        correlationId,
                    },
                },
            });
            throw new Error('Invalid message: missing messageId or jobId');
        }

        // Check if message was already processed (Inbox Pattern)
        const existingInbox =
            await this.inboxRepository.findByConsumerAndMessageId(
                this.consumerId,
                messageId,
            );

        if (existingInbox && existingInbox.processed) {
            this.logger.warn({
                message: 'Duplicate message detected, skipping processing',
                context: WorkflowJobConsumer.name,
                metadata: {
                    messageId,
                    jobId: unwrappedMessage.jobId,
                    consumerId: this.consumerId,
                },
            });
            return;
        }

        // Define correlation ID no contexto de observabilidade para propagação
        if (correlationId) {
            const obs = this.observability as any;
            if (obs.setContext) {
                obs.setContext({ correlationId });
            }
        }

        return await this.observability.runInSpan(
            'workflow.job.consume',
            async (span) => {
                span.setAttributes({
                    'workflow.job.id': unwrappedMessage.jobId,
                    'workflow.correlation.id': correlationId,
                    'workflow.message.id': messageId,
                });

                try {
                    // Create inbox record if it doesn't exist
                    if (!existingInbox) {
                        await this.inboxRepository.create(
                            messageId,
                            unwrappedMessage.jobId,
                            this.consumerId,
                        );
                    }

                    // Processa o job
                    await this.jobProcessor.process(unwrappedMessage.jobId);

                    // Mark as processed
                    await this.inboxRepository.markAsProcessed(
                        messageId,
                        this.consumerId,
                    );

                    this.logger.log({
                        message: 'Workflow job processed successfully',
                        context: WorkflowJobConsumer.name,
                        metadata: {
                            messageId,
                            jobId: unwrappedMessage.jobId,
                            correlationId,
                        },
                    });

                    span.setAttributes({
                        'workflow.job.processed': true,
                    });
                } catch (error) {
                    span.setAttributes({
                        'error': true,
                        'exception.type': error.name,
                        'exception.message': error.message,
                    });

                    this.logger.error({
                        message: 'Failed to process workflow job',
                        context: WorkflowJobConsumer.name,
                        error,
                        metadata: {
                            messageId,
                            jobId: unwrappedMessage.jobId,
                            correlationId,
                        },
                    });

                    // Re-throw para que RabbitMQ possa fazer retry ou enviar para DLQ
                    throw error;
                }
            },
            {
                'workflow.component': 'consumer',
                'workflow.operation': 'process_job',
            },
        );
    }

    private isMessagePayload(
        message: any,
    ): message is MessagePayload<WorkflowJobMessage> {
        return (
            message &&
            typeof message === 'object' &&
            'event_name' in message &&
            'payload' in message
        );
    }
}
