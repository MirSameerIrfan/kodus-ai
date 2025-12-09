import { RabbitMQConfig } from '@libs/core/domain/types/environment/rabbitMQ.type';
import { registerAs } from '@nestjs/config';

export const RabbitMQLoader = registerAs(
    'rabbitMQConfig',
    (): RabbitMQConfig => ({
        API_RABBITMQ_URI:
            process.env.API_RABBITMQ_URI || 'amqp://localhost:5672/',
        API_RABBITMQ_ENABLED:
            process.env.API_RABBITMQ_ENABLED === 'true' || true,
    }),
);
