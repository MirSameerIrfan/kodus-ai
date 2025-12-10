import { Module, Global } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

// Engine
import { DurablePipelineExecutor } from './engine/executor/durable-pipeline-executor.service';
import { PipelineStateManager } from './engine/state/pipeline-state-manager.service';
import { HeavyStageEventHandler } from './engine/heavy-stage-event.handler';
import { EventBufferService } from './engine/event-buffer.service';

// Infrastructure
import { RabbitMQJobQueueService } from './infrastructure/rabbitmq-job-queue.service';
import { WorkflowJobConsumer } from './infrastructure/workflow-job-consumer.service';
import { WorkflowResumedConsumer } from './infrastructure/workflow-resumed-consumer.service';
import { JobStatusService } from './infrastructure/job-status.service';
import { RetryPolicyService } from './infrastructure/retry-policy.service';
import { DistributedLockService } from './infrastructure/distributed-lock.service';
import { ErrorClassifierService } from './infrastructure/error-classifier.service';
import { TransactionalInboxService } from './infrastructure/transactional-inbox.service';
import { TransactionalOutboxService } from './infrastructure/transactional-outbox.service';
import { OutboxRelayService } from './infrastructure/outbox-relay.service';
import { JobProcessorRouterService } from './infrastructure/job-processor-router.service';
import { WebhookProcessingJobProcessorService } from './infrastructure/webhook-processing-job-processor.service';

// Use Cases
import { EnqueueCodeReviewJobUseCase } from './application/use-cases/enqueue-code-review-job.use-case.ts';
import { ProcessWorkflowJobUseCase } from './application/use-cases/process-workflow-job.use-case.ts';
import { GetJobStatusUseCase } from './application/use-cases/get-job-status.use-case.ts';

// Contracts
import { JOB_QUEUE_SERVICE_TOKEN } from './domain/contracts/job-queue.service.contract';
import { JOB_STATUS_SERVICE_TOKEN } from './domain/contracts/job-status.service.contract';
import { JOB_PROCESSOR_SERVICE_TOKEN } from './domain/contracts/job-processor.service.contract';
import { ERROR_CLASSIFIER_SERVICE_TOKEN } from './domain/contracts/error-classifier.service.contract';

@Global()
@Module({
    imports: [
        RabbitMQModule.forRoot(RabbitMQModule, {
            exchanges: [
                {
                    name: 'workflow.events',
                    type: 'topic',
                },
                {
                    name: 'workflow.exchange',
                    type: 'topic',
                },
            ],
            uri:
                process.env.RABBITMQ_URI || 'amqp://guest:guest@localhost:5672',
            connectionInitOptions: { wait: false },
        }),
    ],
    providers: [
        // Engine
        DurablePipelineExecutor,
        PipelineStateManager,
        HeavyStageEventHandler,
        EventBufferService,

        // Infrastructure Services
        {
            provide: JOB_QUEUE_SERVICE_TOKEN,
            useClass: RabbitMQJobQueueService,
        },
        {
            provide: JOB_STATUS_SERVICE_TOKEN,
            useClass: JobStatusService,
        },
        {
            provide: JOB_PROCESSOR_SERVICE_TOKEN,
            useClass: JobProcessorRouterService,
        },
        {
            provide: ERROR_CLASSIFIER_SERVICE_TOKEN,
            useClass: ErrorClassifierService,
        },
        RetryPolicyService,
        DistributedLockService,
        TransactionalInboxService,
        TransactionalOutboxService,
        OutboxRelayService,
        JobProcessorRouterService,

        // Processors
        WebhookProcessingJobProcessorService,

        // Consumers
        WorkflowJobConsumer,
        WorkflowResumedConsumer,

        // Use Cases
        EnqueueCodeReviewJobUseCase,
        ProcessWorkflowJobUseCase,
        GetJobStatusUseCase,
    ],
    exports: [
        // Engine
        DurablePipelineExecutor,
        PipelineStateManager,
        HeavyStageEventHandler,
        EventBufferService,

        // Infrastructure
        JOB_QUEUE_SERVICE_TOKEN,
        JOB_STATUS_SERVICE_TOKEN,
        JOB_PROCESSOR_SERVICE_TOKEN,
        ERROR_CLASSIFIER_SERVICE_TOKEN,
        RetryPolicyService,
        DistributedLockService,
        TransactionalInboxService,
        TransactionalOutboxService,
        OutboxRelayService,

        // Use Cases
        EnqueueCodeReviewJobUseCase,
        ProcessWorkflowJobUseCase,
        GetJobStatusUseCase,

        // RabbitMQ
        RabbitMQModule,
    ],
})
export class WorkflowModule {}
