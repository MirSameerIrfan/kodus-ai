import { Module } from '@nestjs/common';
import { WebhookLogService } from '../../infrastructure/services/webhook-log.service';
import { WebhookLogRepository } from '../../infrastructure/repositories/mongoose/webhook-log.repository';
import { WEBHOOK_LOG_SERVICE_TOKEN } from '../../domain/webhook-log/contracts/webhook-log.service.contract';
import { WEBHOOK_LOG_REPOSITORY_TOKEN } from '../../domain/webhook-log/contracts/webhook-log.repository.contract';
import { MongooseModule } from '@nestjs/mongoose';
import {
    WebhookLogModel,
    WebhookLogSchema,
} from '../../infrastructure/repositories/mongoose/webhook-log.model';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: WebhookLogModel.name, schema: WebhookLogSchema },
        ]),
    ],
    providers: [
        {
            provide: WEBHOOK_LOG_SERVICE_TOKEN,
            useClass: WebhookLogService,
        },
        {
            provide: WEBHOOK_LOG_REPOSITORY_TOKEN,
            useClass: WebhookLogRepository,
        },
    ],
    exports: [WEBHOOK_LOG_SERVICE_TOKEN, WEBHOOK_LOG_REPOSITORY_TOKEN],
})
export class WebhookLogModule {}
