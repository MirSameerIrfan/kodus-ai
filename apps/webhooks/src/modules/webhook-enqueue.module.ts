import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQWrapperModule } from '@libs/core/queue/rabbitmq.module';
import { LogModule } from '@libs/analytics/modules/log.module';
import { JOB_QUEUE_SERVICE_TOKEN } from '@libs/workflow-queue/domain/contracts/job-queue.service.contract';
import { RabbitMQJobQueueService } from '@libs/workflow-queue/infrastructure/rabbitmq-job-queue.service';
import { WorkflowQueueLoader } from '@libs/core/config/loaders/workflow-queue.loader';
import { WorkflowJobModel } from '@libs/core/database/typeorm/schema/workflow-job.model';
import { OutboxMessageModel } from '@libs/core/database/typeorm/schema/outbox-message.model';
import { WorkflowJobRepository } from '@libs/core/database/typeorm/repositories/workflow-job.repository';
import { OutboxMessageRepository } from '@libs/core/database/typeorm/repositories/outbox-message.repository';
import { TransactionalOutboxService } from '@libs/workflow-queue/infrastructure/transactional-outbox.service';
import { EnqueueWebhookUseCase } from '@libs/platform/application/use-cases/webhook/enqueue-webhook.use-case';

@Module({
    imports: [
        ConfigModule.forFeature(WorkflowQueueLoader),
        TypeOrmModule.forFeature([WorkflowJobModel, OutboxMessageModel]),
        RabbitMQWrapperModule.register(),
        LogModule,
    ],
    providers: [
        WorkflowJobRepository,
        OutboxMessageRepository,
        TransactionalOutboxService,
        RabbitMQJobQueueService,
        {
            provide: JOB_QUEUE_SERVICE_TOKEN,
            useClass: RabbitMQJobQueueService,
        },
        EnqueueWebhookUseCase,
    ],
    exports: [EnqueueWebhookUseCase],
})
export class WebhookEnqueueModule {}
