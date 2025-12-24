import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { createLogger } from '@kodus/flow';
import {
    BackoffOptions,
    calculateBackoffInterval,
} from '@libs/common/utils/polling';

/**
 * Backoff configuration for consumer retries.
 * Progression: 2s, 4s, 8s (3 attempts max, then DLQ)
 */
const CONSUMER_BACKOFF: BackoffOptions = {
    baseInterval: 2000, // 2 seconds
    maxInterval: 30000, // 30 seconds cap
    jitterFactor: 0.1, // ±10% jitter
    multiplier: 2, // Exponential
};

const MAX_RETRIES_CONSUMER = 3;

/**
 * Handles RabbitMQ consumer errors with retry logic and DLQ support.
 *
 * IMPORTANT: Requires the following RabbitMQ topology:
 * - For any `<base>` exchange in use:
 *   - `<base>.delayed` (type: x-delayed-message, x-delayed-type: topic)
 *   - `<base>.dlx` (type: topic)
 * - The delayed exchange plugin must be installed: rabbitmq_delayed_message_exchange
 */
@Injectable()
export class RabbitMQErrorHandler implements OnModuleInit {
    private static _instance: RabbitMQErrorHandler;
    private readonly logger = createLogger(RabbitMQErrorHandler.name);
    private readonly RETRY_COUNT_HEADER = 'x-retry-count';

    constructor(private readonly amqpConnection: AmqpConnection) {}

    onModuleInit() {
        // Set instance for static access (required by @RabbitSubscribe errorHandler)
        // This is a workaround for the golevelup library limitation
        RabbitMQErrorHandler._instance = this;
    }

    static get instance(): RabbitMQErrorHandler | undefined {
        return RabbitMQErrorHandler._instance;
    }

    async handle(
        channel: any,
        msg: ConsumeMessage,
        error: any,
        options?: { dlqRoutingKey?: string },
    ): Promise<void> {
        const headers = { ...msg.properties.headers };
        const retryCount = (headers[this.RETRY_COUNT_HEADER] || 0) as number;
        const messageId = msg.properties.messageId;
        const baseExchange = this.getBaseExchange(msg.fields.exchange);
        const delayedExchange = `${baseExchange}.delayed`;
        const dlxExchange = `${baseExchange}.dlx`;

        try {
            if (retryCount < MAX_RETRIES_CONSUMER) {
                await this.retryWithDelay(
                    msg,
                    headers,
                    retryCount,
                    error,
                    delayedExchange,
                );
            } else {
                await this.sendToDLQ(
                    msg,
                    headers,
                    error,
                    dlxExchange,
                    options?.dlqRoutingKey,
                );
            }
        } catch (publishError) {
            // CRITICAL: If we can't republish, the message would be lost (already ACKed by errorBehavior)
            // Log as FATAL and throw to make this visible in monitoring
            this.logger.error({
                message:
                    'CRITICAL: Failed to republish message after error - MESSAGE MAY BE LOST',
                context: RabbitMQErrorHandler.name,
                error: publishError,
                metadata: {
                    messageId,
                    routingKey: msg.fields.routingKey,
                    originalError: error?.message,
                    retryCount,
                    dlqRoutingKey: options?.dlqRoutingKey,
                },
            });

            // Throw to ensure this is visible and potentially crash the process
            // In production, you may want to implement a fallback (e.g., write to disk/DB)
            throw new Error(
                `CRITICAL: Message ${messageId} may be lost - republish failed: ${publishError.message}`,
            );
        }
    }

    private async retryWithDelay(
        msg: ConsumeMessage,
        headers: Record<string, any>,
        retryCount: number,
        error: any,
        delayedExchange: string,
    ): Promise<void> {
        const nextRetryCount = retryCount + 1;
        headers[this.RETRY_COUNT_HEADER] = nextRetryCount;

        // Use centralized backoff calculation
        const delayMs = calculateBackoffInterval(
            nextRetryCount,
            CONSUMER_BACKOFF,
        );
        headers['x-delay'] = delayMs;

        this.logger.warn({
            message: `Message processing failed, retrying (${nextRetryCount}/${MAX_RETRIES_CONSUMER})`,
            context: RabbitMQErrorHandler.name,
            metadata: {
                messageId: msg.properties.messageId,
                routingKey: msg.fields.routingKey,
                retryCount: nextRetryCount,
                delayMs,
                error: error?.message,
            },
        });

        await this.amqpConnection.publish(
            delayedExchange,
            msg.fields.routingKey,
            msg.content,
            {
                messageId: msg.properties.messageId,
                correlationId: msg.properties.correlationId,
                contentType: msg.properties.contentType,
                contentEncoding: msg.properties.contentEncoding,
                persistent: true,
                headers: headers,
            },
        );
    }

    private async sendToDLQ(
        msg: ConsumeMessage,
        headers: Record<string, any>,
        error: any,
        dlxExchange: string,
        dlqRoutingKey?: string,
    ): Promise<void> {
        const routingKeyForDlq = dlqRoutingKey || msg.fields.routingKey;

        this.logger.error({
            message: 'Max retries exceeded, sending to DLQ',
            context: RabbitMQErrorHandler.name,
            metadata: {
                messageId: msg.properties.messageId,
                routingKey: msg.fields.routingKey,
                dlqRoutingKey: routingKeyForDlq,
                error: error?.message,
                exchange: msg.fields.exchange,
                dlxExchange,
            },
        });

        headers['x-original-routing-key'] = msg.fields.routingKey;
        headers['x-original-exchange'] = msg.fields.exchange;
        headers['x-death-reason'] = 'max-retries-exceeded';
        headers['x-last-error'] = error?.message?.substring(0, 500);

        await this.amqpConnection.publish(
            dlxExchange,
            routingKeyForDlq,
            msg.content,
            {
                messageId: msg.properties.messageId,
                correlationId: msg.properties.correlationId,
                contentType: msg.properties.contentType,
                contentEncoding: msg.properties.contentEncoding,
                persistent: true,
                headers: headers,
            },
        );
    }

    private getBaseExchange(exchange: string): string {
        if (exchange.endsWith('.delayed')) {
            return exchange.slice(0, -'.delayed'.length);
        }
        if (exchange.endsWith('.dlx')) {
            return exchange.slice(0, -'.dlx'.length);
        }
        return exchange;
    }
}
