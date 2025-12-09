import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';


import { LogModule } from '@libs/analytics/modules/log.module';
import { DatabaseModule } from '@libs/core/infrastructure/database/database.module';
import { RabbitMQWrapperModule } from '@libs/core/infrastructure/queue/rabbitmq.module';
import { WebhookLogModule } from '@libs/platform/modules/webhook-log/webhook-log.module';

import { WebhookEnqueueModule } from './webhook-enqueue.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        EventEmitterModule.forRoot(),
        RabbitMQWrapperModule.register(),
        LogModule,
        DatabaseModule,
        WebhookLogModule,
        WebhookEnqueueModule,
    ],
})
export class WebhookHandlerBaseModule {}
