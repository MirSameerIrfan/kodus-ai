import { Injectable, Inject, forwardRef } from '@nestjs/common';

import { IJobProcessorRouter } from '@libs/core/workflow/domain/contracts/job-processor-router.contract';
import { IJobProcessorService } from '@libs/core/workflow/domain/contracts/job-processor.service.contract';
import {
    IWorkflowJobRepository,
    WORKFLOW_JOB_REPOSITORY_TOKEN,
} from '@libs/core/workflow/domain/contracts/workflow-job.repository.contract';
import { WorkflowType } from '@libs/core/workflow/domain/enums/workflow-type.enum';

import { WebhookProcessingJobProcessorService } from '@libs/automation/webhook-processing/webhook-processing-job.processor';
import { CodeReviewJobProcessorService } from '@libs/code-review/workflow/code-review-job-processor.service';

/**
 * Router that selects the correct job processor based on workflow type
 */
@Injectable()
export class JobProcessorRouterService
    implements IJobProcessorService, IJobProcessorRouter
{
    constructor(
        @Inject(WORKFLOW_JOB_REPOSITORY_TOKEN)
        private readonly jobRepository: IWorkflowJobRepository,
        @Inject(forwardRef(() => CodeReviewJobProcessorService))
        private readonly codeReviewProcessor: CodeReviewJobProcessorService,
        private readonly webhookProcessor: WebhookProcessingJobProcessorService,
    ) {}

    async process(jobId: string): Promise<void> {
        const job = await this.jobRepository.findOne(jobId);
        if (!job) {
            throw new Error(`Workflow job ${jobId} not found`);
        }

        // Route to appropriate processor based on workflow type
        const processor = this.getProcessor(job.workflowType);
        return await processor.process(jobId);
    }

    async handleFailure(jobId: string, error: Error): Promise<void> {
        const job = await this.jobRepository.findOne(jobId);
        if (!job) {
            throw new Error(`Workflow job ${jobId} not found`);
        }

        const processor = this.getProcessor(job.workflowType);
        return await processor.handleFailure(jobId, error);
    }

    async markCompleted(jobId: string, result?: unknown): Promise<void> {
        const job = await this.jobRepository.findOne(jobId);
        if (!job) {
            throw new Error(`Workflow job ${jobId} not found`);
        }

        const processor = this.getProcessor(job.workflowType);
        return await processor.markCompleted(jobId, result);
    }

    private getProcessor(workflowType: WorkflowType): IJobProcessorService {
        switch (workflowType) {
            case WorkflowType.WEBHOOK_PROCESSING:
                return this.webhookProcessor;
            case WorkflowType.CODE_REVIEW:
                return this.codeReviewProcessor;
            default:
                throw new Error(
                    `No processor found for workflow type: ${workflowType}`,
                );
        }
    }
}
