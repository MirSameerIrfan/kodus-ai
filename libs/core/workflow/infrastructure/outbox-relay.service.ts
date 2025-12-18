import { createLogger } from '@kodus/flow';
import { ObservabilityService } from '@libs/core/log/observability.service';
import {
    Injectable,
    Inject,
    OnApplicationBootstrap,
    OnModuleDestroy,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { OutboxMessageRepository } from './repositories/outbox-message.repository';
import { InboxMessageRepository } from './repositories/inbox-message.repository';
import { OutboxMessageModel } from './repositories/schemas/outbox-message.model';
import {
    IMessageBrokerService,
    MESSAGE_BROKER_SERVICE_TOKEN,
    MessagePayload,
} from '@libs/core/domain/contracts/message-broker.service.contracts';

// Helper interface to type the payload content we expect
interface MessagePayloadContent {
    correlationId?: string;
    workflowType?: string;
    jobId?: string;
    [key: string]: unknown;
}

@Injectable()
export class OutboxRelayService
    implements OnApplicationBootstrap, OnModuleDestroy
{
    private isProcessing = false;
    private isCleaning = false;
    private relayInterval: NodeJS.Timeout;

    private readonly logger = createLogger(OutboxRelayService.name);

    constructor(
        private readonly outboxRepository: OutboxMessageRepository,
        private readonly inboxRepository: InboxMessageRepository,
        @Inject(MESSAGE_BROKER_SERVICE_TOKEN)
        private readonly messageBroker: IMessageBrokerService,
        private readonly observability: ObservabilityService,
    ) {}

    onApplicationBootstrap() {
        console.log(
            '--- OutboxRelayService: Starting manual polling loop (1s) ---',
        );
        this.relayInterval = setInterval(() => {
            this.processOutbox().catch((err) => {
                console.error('--- OutboxRelayService Error ---', err);
            });
        }, 1000);
    }

    onModuleDestroy() {
        if (this.relayInterval) {
            clearInterval(this.relayInterval);
        }
    }

    /**
     * Processa mensagens pendentes do outbox e publica no RabbitMQ
     */
    async processOutbox(): Promise<void> {
        if (this.isProcessing) {
            return; // Evitar processamento concorrente
        }

        console.log('--- [OutboxRelay] Polling database... ---');
        this.isProcessing = true;

        try {
            return await this.observability.runInSpan(
                'workflow.outbox.relay',
                async (span) => {
                    this.logger.debug({
                        message: 'Checking for unprocessed outbox messages',
                        context: OutboxRelayService.name,
                    });

                    const messages =
                        await this.outboxRepository.findUnprocessed(100);

                    if (messages.length > 0) {
                        this.logger.log({
                            message: 'Processing outbox messages',
                            context: OutboxRelayService.name,
                            metadata: {
                                count: messages.length,
                            },
                        });
                    }

                    for (const message of messages) {
                        await this.processMessage(message);
                    }
                },
                {
                    'workflow.component': 'outbox',
                    'workflow.operation': 'relay',
                },
            );
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Data Hygiene: Cleans up processed messages older than 7 days.
     * Runs daily at midnight.
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanupOldMessages(): Promise<void> {
        if (this.isCleaning) {
            return;
        }

        this.isCleaning = true;

        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            this.logger.log({
                message: 'Starting cleanup of old outbox/inbox messages',
                context: OutboxRelayService.name,
                metadata: { threshold: sevenDaysAgo },
            });

            // Cleanup Outbox
            const deletedOutboxCount =
                await this.outboxRepository.deleteProcessedOlderThan(
                    sevenDaysAgo,
                );

            // Cleanup Inbox
            const deletedInboxCount =
                await this.inboxRepository.deleteProcessedOlderThan(
                    sevenDaysAgo,
                );

            this.logger.log({
                message: 'Completed cleanup of old messages',
                context: OutboxRelayService.name,
                metadata: { deletedOutboxCount, deletedInboxCount },
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to cleanup old messages',
                context: OutboxRelayService.name,
                error,
            });
        } finally {
            this.isCleaning = false;
        }
    }

    private async processMessage(message: OutboxMessageModel): Promise<void> {
        return await this.observability.runInSpan(
            'workflow.outbox.publish',
            async (span) => {
                span.setAttributes({
                    'workflow.outbox.message.id': message.uuid,
                    'workflow.outbox.job.id': message.job?.uuid,
                    'workflow.outbox.exchange': message.exchange,
                    'workflow.outbox.routing_key': message.routingKey,
                });

                try {
                    // Safe access to payload properties using the helper interface
                    const payloadContent =
                        (
                            message.payload as unknown as MessagePayload<MessagePayloadContent>
                        ).payload ||
                        (message.payload as unknown as MessagePayloadContent);

                    const correlationId = payloadContent?.correlationId;
                    const workflowType = payloadContent?.workflowType;
                    const jobId = payloadContent?.jobId;

                    await this.messageBroker.publishMessage(
                        {
                            exchange: message.exchange,
                            routingKey: message.routingKey,
                        },
                        message.payload as unknown as MessagePayload,
                        {
                            messageId: message.uuid,
                            correlationId,
                            persistent: true,
                            headers: {
                                'x-correlation-id': correlationId,
                                'x-workflow-type': workflowType,
                                'x-job-id': jobId,
                            },
                        },
                    );

                    // Marcar como processada apenas após Publisher Confirm
                    await this.outboxRepository.markAsProcessed(message.uuid);

                    span.setAttributes({
                        'workflow.outbox.published': true,
                    });

                    this.logger.log({
                        message: 'Outbox message published to RabbitMQ',
                        context: OutboxRelayService.name,
                        metadata: {
                            messageId: message.uuid,
                            jobId: message.job?.uuid,
                            correlationId,
                            exchange: message.exchange,
                            routingKey: message.routingKey,
                        },
                    });
                } catch (error) {
                    span.setAttributes({
                        'error': true,
                        'exception.type': error.name,
                        'exception.message': error.message,
                    });

                    this.logger.error({
                        message: 'Failed to publish outbox message',
                        context: OutboxRelayService.name,
                        error,
                        metadata: {
                            messageId: message.uuid,
                            jobId: message.job?.uuid,
                        },
                    });

                    // Não marca como processada - será reprocessada na próxima iteração
                    throw error;
                }
            },
        );
    }
}
