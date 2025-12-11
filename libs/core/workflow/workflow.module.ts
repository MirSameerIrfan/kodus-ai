import { DynamicModule, Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { TypeOrmModule } from '@nestjs/typeorm';

// Engine
import { DurablePipelineExecutor } from './engine/executor/durable-pipeline-executor.service';
import { PipelineStateManager } from './engine/state/pipeline-state-manager.service';
import { HeavyStageEventHandler } from './engine/heavy-stage-event.handler';
import { EventBufferService } from './engine/event-buffer.service';

// Infrastructure - Repositories & Models
import { WorkflowJobModel } from './infrastructure/repositories/schemas/workflow-job.model';
import { OutboxMessageModel } from './infrastructure/repositories/schemas/outbox-message.model';
import { InboxMessageModel } from './infrastructure/repositories/schemas/inbox-message.model';
import { WorkflowJobRepository } from './infrastructure/repositories/workflow-job.repository';
import { OutboxMessageRepository } from './infrastructure/repositories/outbox-message.repository';
import { InboxMessageRepository } from './infrastructure/repositories/inbox-message.repository';

// Infrastructure - Services
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
import { ASTEventHandler } from './infrastructure/ast-event-handler.service';
import { WebhookProcessingJobProcessorService } from '@libs/automation/webhook-processing/webhook-processing-job.processor';

// Domain contracts
import { JOB_QUEUE_SERVICE_TOKEN } from './domain/contracts/job-queue.service.contract';
import { JOB_STATUS_SERVICE_TOKEN } from './domain/contracts/job-status.service.contract';
import { JOB_PROCESSOR_SERVICE_TOKEN } from './domain/contracts/job-processor.service.contract';
import { ERROR_CLASSIFIER_SERVICE_TOKEN } from './domain/contracts/error-classifier.service.contract';
import { WORKFLOW_JOB_REPOSITORY_TOKEN } from './domain/contracts/workflow-job.repository.contract';

// Use Cases
import { EnqueueCodeReviewJobUseCase } from './application/use-cases/enqueue-code-review-job.use-case';
import { ProcessWorkflowJobUseCase } from './application/use-cases/process-workflow-job.use-case';
import { GetJobStatusUseCase } from './application/use-cases/get-job-status.use-case';

const sharedProviders = [
    // Repositories
    WorkflowJobRepository,
    OutboxMessageRepository,
    InboxMessageRepository,
    {
        provide: WORKFLOW_JOB_REPOSITORY_TOKEN,
        useClass: WorkflowJobRepository,
    },

    // Infrastructure Services
    {
        provide: JOB_QUEUE_SERVICE_TOKEN,
        useClass: RabbitMQJobQueueService,
    },
    {
        provide: JOB_STATUS_SERVICE_TOKEN,
        useClass: JobStatusService,
    },
    RetryPolicyService,
    TransactionalOutboxService,

    // Use Cases
    EnqueueCodeReviewJobUseCase,
    GetJobStatusUseCase,
];

const sharedExports = [
    WorkflowJobRepository,
    OutboxMessageRepository,
    InboxMessageRepository,
    WORKFLOW_JOB_REPOSITORY_TOKEN,
    JOB_QUEUE_SERVICE_TOKEN,
    JOB_STATUS_SERVICE_TOKEN,
    RetryPolicyService,
    TransactionalOutboxService,
    EnqueueCodeReviewJobUseCase,
    GetJobStatusUseCase,
];

const workerProviders = [
    // Engine
    DurablePipelineExecutor,
    PipelineStateManager,
    HeavyStageEventHandler,
    EventBufferService,

    // Services
    {
        provide: JOB_PROCESSOR_SERVICE_TOKEN,
        useClass: JobProcessorRouterService,
    },
    {
        provide: ERROR_CLASSIFIER_SERVICE_TOKEN,
        useClass: ErrorClassifierService,
    },
    DistributedLockService,
    TransactionalInboxService,
    OutboxRelayService,
    JobProcessorRouterService,
    ASTEventHandler,

    // Processors
    WebhookProcessingJobProcessorService,

    // Consumers
    WorkflowJobConsumer,
    WorkflowResumedConsumer,

    // Use Cases
    ProcessWorkflowJobUseCase,
];

@Module({})
export class WorkflowModule {
    static register(options: {
        type: 'worker' | 'api' | 'webhook';
    }): DynamicModule {
        const isWorker = options.type === 'worker';

        return {
            module: WorkflowModule,
            imports: [
                TypeOrmModule.forFeature([
                    WorkflowJobModel,
                    OutboxMessageModel,
                    InboxMessageModel,
                ]),
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
                        process.env.RABBITMQ_URI ||
                        'amqp://guest:guest@localhost:5672',
                    connectionInitOptions: { wait: false },
                }),
            ],
            providers: [
                ...sharedProviders,
                ...(isWorker ? workerProviders : []),
            ],
            exports: [
                ...sharedExports,
                RabbitMQModule,
                ...(isWorker ? workerProviders : []),
            ],
        };
    }
}
