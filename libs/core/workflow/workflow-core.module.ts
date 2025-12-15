import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Engine
import { DurablePipelineExecutor } from './engine/executor/durable-pipeline-executor.service';
import { PipelineStateManager } from './engine/state/pipeline-state-manager.service';
import { EventBufferService } from './engine/event-buffer.service';

// Infrastructure - Repositories & Models
import { WorkflowJobModel } from './infrastructure/repositories/schemas/workflow-job.model';
import { WorkflowJobRepository } from './infrastructure/repositories/workflow-job.repository';
import { JobStatusService } from './infrastructure/job-status.service';
import { RetryPolicyService } from './infrastructure/retry-policy.service';

// Domain contracts
import { JOB_STATUS_SERVICE_TOKEN } from './domain/contracts/job-status.service.contract';
import { WORKFLOW_JOB_REPOSITORY_TOKEN } from './domain/contracts/workflow-job.repository.contract';

const coreProviders = [
    // Repositories
    WorkflowJobRepository,
    {
        provide: WORKFLOW_JOB_REPOSITORY_TOKEN,
        useClass: WorkflowJobRepository,
    },

    // Infrastructure Services
    {
        provide: JOB_STATUS_SERVICE_TOKEN,
        useClass: JobStatusService,
    },
    RetryPolicyService,

    // Engine
    DurablePipelineExecutor,
    PipelineStateManager,
    EventBufferService,
];

@Global()
@Module({
    imports: [TypeOrmModule.forFeature([WorkflowJobModel])],
    providers: [...coreProviders],
    exports: [...coreProviders, TypeOrmModule],
})
export class WorkflowCoreModule {}
