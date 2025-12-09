import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { WebhookEnqueueModule } from './webhook-enqueue.module';
import { RabbitMQWrapperModule } from '@libs/core/infrastructure/queue/rabbitmq.module';
import { LogModule } from '@libs/analytics/modules/log.module';
import { DatabaseModule } from '@libs/core/infrastructure/database/database.module';
import { WebhookLogModule } from '@libs/platform/modules/webhook-log/webhook-log.module';

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
