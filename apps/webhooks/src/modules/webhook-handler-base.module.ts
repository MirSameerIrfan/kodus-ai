import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { WebhookEnqueueModule } from './webhook-enqueue.module';
import { WebhookHealthModule } from './webhook-health.module';
import { RabbitMQWrapperModule } from '@/modules/rabbitmq.module';
import { LogModule } from '@/modules/log.module';
import { DatabaseModule } from '@/modules/database.module';
import { WebhookLogModule } from '@/modules/webhookLog.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        EventEmitterModule.forRoot(),
        RabbitMQWrapperModule.register(),
        LogModule,
        DatabaseModule,
        WebhookLogModule,
        WebhookEnqueueModule,
        WebhookHealthModule,
    ],
})
export class WebhookHandlerBaseModule {}
