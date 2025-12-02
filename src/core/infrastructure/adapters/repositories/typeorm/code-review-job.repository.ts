import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { CodeReviewJobModel } from './schema/code-review-job.model';
import { JobExecutionHistoryModel } from './schema/job-execution-history.model';
import { ICodeReviewJob } from '@/core/domain/workflowQueue/interfaces/code-review-job.interface';
import { IJobExecutionHistory } from '@/core/domain/workflowQueue/interfaces/code-review-job.interface';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';

@Injectable()
export class CodeReviewJobRepository {
    constructor(
        @InjectRepository(CodeReviewJobModel)
        private readonly jobRepository: Repository<CodeReviewJobModel>,
        @InjectRepository(JobExecutionHistoryModel)
        private readonly historyRepository: Repository<JobExecutionHistoryModel>,
        private readonly logger: PinoLoggerService,
    ) {}

    async create(
        job: Omit<ICodeReviewJob, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<ICodeReviewJob> {
        try {
            const jobModel = this.jobRepository.create({
                correlationId: job.correlationId,
                platformType: job.platformType,
                repositoryId: job.repositoryId,
                repositoryName: job.repositoryName,
                pullRequestNumber: job.pullRequestNumber,
                pullRequestData: job.pullRequestData,
                organization: { uuid: job.organizationId },
                team: { uuid: job.teamId },
                status: job.status,
                priority: job.priority,
                retryCount: job.retryCount,
                maxRetries: job.maxRetries,
                errorClassification: job.errorClassification,
                lastError: job.lastError,
                scheduledAt: job.scheduledAt,
            });

            const saved = await this.jobRepository.save(jobModel);

            return this.mapToInterface(saved);
        } catch (error) {
            this.logger.error({
                message: 'Failed to create code review job',
                context: CodeReviewJobRepository.name,
                error,
            });
            throw error;
        }
    }

    async findOne(jobId: string): Promise<ICodeReviewJob | null> {
        const job = await this.jobRepository.findOne({
            where: { uuid: jobId },
            relations: ['organization', 'team'],
        });

        return job ? this.mapToInterface(job) : null;
    }

    async update(
        jobId: string,
        updates: Partial<ICodeReviewJob>,
    ): Promise<ICodeReviewJob | null> {
        await this.jobRepository.update(
            { uuid: jobId },
            {
                status: updates.status,
                retryCount: updates.retryCount,
                errorClassification: updates.errorClassification,
                lastError: updates.lastError,
                startedAt: updates.startedAt,
                completedAt: updates.completedAt,
                scheduledAt: updates.scheduledAt,
            },
        );

        return this.findOne(jobId);
    }

    async findMany(filters: {
        status?: JobStatus;
        organizationId?: string;
        teamId?: string;
        platformType?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ data: ICodeReviewJob[]; total: number }> {
        const where: FindOptionsWhere<CodeReviewJobModel> = {};

        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.organizationId) {
            where.organization = { uuid: filters.organizationId };
        }
        if (filters.teamId) {
            where.team = { uuid: filters.teamId };
        }
        if (filters.platformType) {
            where.platformType = filters.platformType as any;
        }

        const [data, total] = await this.jobRepository.findAndCount({
            where,
            relations: ['organization', 'team'],
            take: filters.limit || 50,
            skip: filters.offset || 0,
            order: { createdAt: 'DESC' },
        });

        return {
            data: data.map((job) => this.mapToInterface(job)),
            total,
        };
    }

    async addExecutionHistory(
        jobId: string,
        history: Omit<IJobExecutionHistory, 'id' | 'jobId'>,
    ): Promise<void> {
        const job = await this.jobRepository.findOne({
            where: { uuid: jobId },
        });

        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }

        const historyModel = this.historyRepository.create({
            job,
            attemptNumber: history.attemptNumber,
            status: history.status,
            startedAt: history.startedAt,
            completedAt: history.completedAt,
            durationMs: history.durationMs,
            errorType: history.errorType,
            errorMessage: history.errorMessage,
            metadata: history.metadata,
        });

        await this.historyRepository.save(historyModel);
    }

    async getExecutionHistory(jobId: string): Promise<IJobExecutionHistory[]> {
        const histories = await this.historyRepository.find({
            where: { job: { uuid: jobId } },
            order: { attemptNumber: 'ASC' },
        });

        return histories.map((h) => ({
            id: h.uuid,
            jobId,
            attemptNumber: h.attemptNumber,
            status: h.status,
            startedAt: h.startedAt,
            completedAt: h.completedAt,
            durationMs: h.durationMs,
            errorType: h.errorType,
            errorMessage: h.errorMessage,
            metadata: h.metadata,
        }));
    }

    private mapToInterface(job: CodeReviewJobModel): ICodeReviewJob {
        return {
            id: job.uuid,
            correlationId: job.correlationId,
            platformType: job.platformType,
            repositoryId: job.repositoryId,
            repositoryName: job.repositoryName,
            pullRequestNumber: job.pullRequestNumber,
            pullRequestData: job.pullRequestData,
            organizationId: job.organization?.uuid || '',
            teamId: job.team?.uuid || '',
            status: job.status,
            priority: job.priority,
            retryCount: job.retryCount,
            maxRetries: job.maxRetries,
            errorClassification: job.errorClassification,
            lastError: job.lastError,
            scheduledAt: job.scheduledAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        };
    }
}
