import { ICodeReviewJob } from '../interfaces/code-review-job.interface';

export const JOB_QUEUE_SERVICE_TOKEN = Symbol('JobQueueService');

export interface IJobQueueService {
    enqueue(
        job: Omit<ICodeReviewJob, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<string>;

    getStatus(jobId: string): Promise<ICodeReviewJob | null>;

    listJobs(filters: {
        status?: string;
        organizationId?: string;
        teamId?: string;
        platformType?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: ICodeReviewJob[];
        total: number;
        limit: number;
        offset: number;
    }>;
}
