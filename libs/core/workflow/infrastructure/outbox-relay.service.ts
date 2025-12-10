import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { createLogger } from '@kodus/flow';
import { ObservabilityService } from '@libs/core/log/observability.service';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
    private isProcessing = false;
    private processingInterval?: NodeJS.Timeout;

    private readonly logger = createLogger(OutboxRelayService.name);

    constructor(
        private readonly outboxRepository: OutboxMessageRepository,
        private readonly amqpConnection: AmqpConnection,
        private readonly observability: ObservabilityService,
    ) {}

    onModuleInit() {
        // Iniciar processamento do outbox a cada 1 segundo
        this.processingInterval = setInterval(() => {
            this.processOutbox().catch((error) => {
                this.logger.error({
                    message: 'Error in outbox relay interval',
                    context: OutboxRelayService.name,
                    error,
                });
            });
        }, 1000);
    }

    onModuleDestroy() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
    }

    /**
     * Processa mensagens pendentes do outbox e publica no RabbitMQ
     * Roda via cron ou intervalo configurado
     */
    @Cron(CronExpression.EVERY_SECOND)
    async processOutbox(): Promise<void> {
        if (this.isProcessing) {
            return; // Evitar processamento concorrente
        }

        this.isProcessing = true;

        try {
            return await this.observability.runInSpan(
                'workflow.outbox.relay',
                async (span) => {
                    const messages =
                        await this.outboxRepository.findUnprocessed(100);

                    span.setAttributes({
                        'workflow.outbox.pending_count': messages.length,
                    });

                    if (messages.length === 0) {
                        return;
                    }

                    this.logger.log({
                        message: 'Processing outbox messages',
                        context: OutboxRelayService.name,
                        metadata: {
                            count: messages.length,
                        },
                    });

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

    private async processMessage(
        message: any, // OutboxMessageModel
    ): Promise<void> {
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
                    const correlationId = message.payload
                        .correlationId as string;

                    // Publicar no RabbitMQ com correlation ID nos headers
                    await this.amqpConnection.publish(
                        message.exchange,
                        message.routingKey,
                        message.payload,
                        {
                            messageId: message.uuid,
                            correlationId,
                            persistent: true,
                            headers: {
                                'x-correlation-id': correlationId,
                                'x-workflow-type': message.payload.workflowType,
                                'x-job-id': message.payload.jobId,
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
