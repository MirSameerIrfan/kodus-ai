import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Inject } from '@nestjs/common';
import { UseFilters } from '@nestjs/common';

import { RabbitmqConsumeErrorFilter } from '@libs/core/infrastructure/filters/rabbitmq-consume-error.exception';
import { IJobProcessorService } from '@libs/core/workflow/domain/contracts/job-processor.service.contract';
import { JOB_PROCESSOR_SERVICE_TOKEN } from '@libs/core/workflow/domain/contracts/job-processor.service.contract';

import { ObservabilityService } from '@libs/core/log/observability.service';
import { createLogger } from '@kodus/flow';

interface WorkflowJobMessage {
    jobId: string;
    correlationId: string;
    [key: string]: unknown;
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class WorkflowJobConsumer {
    private readonly logger = createLogger(WorkflowJobConsumer.name);

    constructor(
        @Inject(JOB_PROCESSOR_SERVICE_TOKEN)
        private readonly jobProcessor: IJobProcessorService,
        private readonly observability: ObservabilityService,
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
        message: WorkflowJobMessage,
        amqpMsg: any,
    ): Promise<void> {
        const messageId = amqpMsg?.properties?.messageId || amqpMsg?.messageId;
        // Extrai correlation ID dos headers primeiro, depois do payload, depois das properties
        const correlationId =
            amqpMsg?.properties?.headers?.['x-correlation-id'] ||
            message.correlationId ||
            amqpMsg?.properties?.correlationId;

        if (!messageId || !message.jobId) {
            this.logger.error({
                message:
                    'Invalid workflow job message: missing messageId or jobId',
                context: WorkflowJobConsumer.name,
                metadata: {
                    message,
                    amqpMsg: {
                        messageId,
                        correlationId,
                    },
                },
            });
            throw new Error('Invalid message: missing messageId or jobId');
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
                    'workflow.job.id': message.jobId,
                    'workflow.correlation.id': correlationId,
                    'workflow.message.id': messageId,
                });

                try {
                    // Processa o job
                    await this.jobProcessor.process(message.jobId);

                    this.logger.log({
                        message: 'Workflow job processed successfully',
                        context: WorkflowJobConsumer.name,
                        metadata: {
                            messageId,
                            jobId: message.jobId,
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
                            jobId: message.jobId,
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
}
