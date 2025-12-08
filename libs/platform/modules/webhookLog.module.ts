import { WEBHOOK_LOG_REPOSITORY } from '@libs/platform/domain/webhook-log/contracts/webhook-log.repository.contract';
import { WEBHOOK_LOG_SERVICE } from '@libs/platform/domain/webhook-log/contracts/webhook-log.service.contract';
import {
    WebhookLogModel,
    WebhookLogSchema,
} from '@libs/platform/infrastructure/repositories/mongoose/webhook-log.model';
import { WebhookLogRepository } from '@libs/platform/infrastructure/repositories/mongoose/webhook-log.repository';
import { WebhookLogService } from '@libs/platform/infrastructure/webhook-log/webhook-log.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: WebhookLogModel.name, schema: WebhookLogSchema },
        ]),
    ],
    providers: [
        {
            provide: WEBHOOK_LOG_REPOSITORY,
            useClass: WebhookLogRepository,
        },
        {
            provide: WEBHOOK_LOG_SERVICE,
            useClass: WebhookLogService,
        },
    ],
    exports: [WEBHOOK_LOG_SERVICE],
    controllers: [],
})
export class WebhookLogModule {}
