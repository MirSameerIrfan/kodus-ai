import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WEBHOOK_LOG_REPOSITORY_TOKEN } from './domain/contracts/webhook-log.repository.contract';
import { WEBHOOK_LOG_SERVICE_TOKEN } from './domain/contracts/webhook-log.service.contract';
import {
    WebhookLogModel,
    WebhookLogSchema,
} from './infrastructure/repositories/mongoose/schemas/webhook-log.model';
import { WebhookLogRepository } from './infrastructure/repositories/mongoose/webhook-log.repository';
import { WebhookLogService } from './infrastructure/services/webhook-log.service';

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
