import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { WebhookHealthController } from '../controllers/webhook-health.controller';
import { RabbitMQWrapperModule } from '@/modules/rabbitmq.module';
import { LogModule } from '@/modules/log.module';
import { DatabaseModule } from '@/modules/database.module';

@Module({
    imports: [
        TerminusModule,
        RabbitMQWrapperModule.register(),
        DatabaseModule,
        LogModule,
    ],
    controllers: [WebhookHealthController],
    providers: [],
    exports: [],
})
export class WebhookHealthModule {}
