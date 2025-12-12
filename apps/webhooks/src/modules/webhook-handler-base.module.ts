import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { DatabaseModule } from '@libs/core/infrastructure/database/database.module';
import { RabbitMQWrapperModule } from '@libs/core/infrastructure/queue/rabbitmq.module';

import { WebhookEnqueueModule } from './webhook-enqueue.module';
import { WebhookLogModule } from '@libs/webhookLog/webhook-log.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        EventEmitterModule.forRoot(),
        RabbitMQWrapperModule.register(),
        DatabaseModule,
        WebhookLogModule,
        WebhookEnqueueModule,
    ],
})
export class WebhookHandlerBaseModule {}
