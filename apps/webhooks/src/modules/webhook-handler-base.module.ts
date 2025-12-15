import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { RabbitMQWrapperModule } from '@libs/core/infrastructure/queue/rabbitmq.module';

import { WebhookEnqueueModule } from './webhook-enqueue.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        EventEmitterModule.forRoot(),
        RabbitMQWrapperModule.register(),
        WebhookEnqueueModule,
    ],
})
export class WebhookHandlerBaseModule {}
