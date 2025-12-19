import {
    RabbitSubscribe,
    MessageHandlerErrorBehavior,
} from '@golevelup/nestjs-rabbitmq';
import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';

import { SaveCodeReviewFeedbackUseCase } from '@libs/code-review/application/use-cases/codeReviewFeedback/save-feedback.use-case';
import { RabbitMQErrorHandler } from '@libs/core/infrastructure/queue/rabbitmq-error.handler';

@Injectable()
export class CodeReviewFeedbackConsumer {
    private readonly logger = createLogger(CodeReviewFeedbackConsumer.name);
    constructor(
        private readonly saveCodeReviewFeedbackUseCase: SaveCodeReviewFeedbackUseCase,
    ) {}

    @RabbitSubscribe({
        exchange: 'orchestrator.exchange.delayed',
        routingKey: 'codeReviewFeedback.syncCodeReviewReactions',
        queue: 'codeReviewFeedback.syncCodeReviewReactions.queue',
        allowNonJsonMessages: true,
        errorBehavior: MessageHandlerErrorBehavior.ACK,
        errorHandler: (channel, msg, err) =>
            RabbitMQErrorHandler.instance?.handle(channel, msg, err, {
                dlqRoutingKey: 'codeReviewFeedback.syncCodeReviewReactions',
            }),
        queueOptions: {
            arguments: {
                'x-queue-type': 'quorum',
                'x-dead-letter-exchange': 'orchestrator.exchange.dlx',
                'x-dead-letter-routing-key':
                    'codeReviewFeedback.syncCodeReviewReactions',
            },
        },
    })
    async handleSyncCodeReviewReactions(message: any) {
        const payload = message?.payload;

        if (payload) {
            try {
                await this.saveCodeReviewFeedbackUseCase.execute(payload);
                this.logger.debug({
                    message: `Code review feedback processing for team ${payload.teamId} completed successfully.`,
                    context: CodeReviewFeedbackConsumer.name,
                    metadata: {
                        teamId: payload.teamId,
                        organizationId: payload.organizationId,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                this.logger.error({
                    message: `Error processing code review feedback for team ${payload.teamId}`,
                    context: CodeReviewFeedbackConsumer.name,
                    error: error.message,
                    metadata: {
                        teamId: payload.teamId,
                        organizationId: payload.organizationId,
                        timestamp: new Date().toISOString(),
                    },
                });

                throw error;
            }
        } else {
            this.logger.error({
                message: 'Message without payload received by the consumer',
                context: CodeReviewFeedbackConsumer.name,
                metadata: {
                    message,
                    timestamp: new Date().toISOString(),
                },
            });

            throw new Error('Invalid message: no payload');
        }
    }
}
