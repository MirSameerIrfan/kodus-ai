import { Injectable } from '@nestjs/common';

import { WorkflowJobRepository } from '@libs/core/infrastructure/database/typeorm/repositories/workflow-job.repository';
import { IJobProcessorService } from '@libs/core/workflow/domain/contracts/job-processor.service.contract';
import { WorkflowType } from '@libs/core/workflow/domain/enums/workflow-type.enum';

import { CodeReviewJobProcessorService } from './code-review-job-processor.service';
import { WebhookProcessingJobProcessorService } from './webhook-processing-job-processor.service';

/**
 * Router that selects the correct job processor based on workflow type
 */
@Injectable()
export class JobProcessorRouterService implements IJobProcessorService {
    constructor(
        private readonly jobRepository: WorkflowJobRepository,
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
