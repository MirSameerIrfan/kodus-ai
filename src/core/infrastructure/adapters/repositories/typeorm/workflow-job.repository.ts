import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { WorkflowJobModel } from './schema/workflow-job.model';
import { JobExecutionHistoryModel } from './schema/job-execution-history.model';
import { IWorkflowJob } from '@/core/domain/workflowQueue/interfaces/workflow-job.interface';
import { IJobExecutionHistory } from '@/core/domain/workflowQueue/interfaces/job-execution-history.interface';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
import { WorkflowType } from '@/core/domain/workflowQueue/enums/workflow-type.enum';

@Injectable()
export class WorkflowJobRepository {
    constructor(
        @InjectRepository(WorkflowJobModel)
        private readonly jobRepository: Repository<WorkflowJobModel>,
        @InjectRepository(JobExecutionHistoryModel)
        private readonly historyRepository: Repository<JobExecutionHistoryModel>,
        private readonly logger: PinoLoggerService,
    ) {}

    async create(
        job: Omit<IWorkflowJob, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<IWorkflowJob> {
        try {
            const jobModel = this.jobRepository.create({
                correlationId: job.correlationId,
                workflowType: job.workflowType,
                handlerType: job.handlerType,
                payload: job.payload,
                organization: { uuid: job.organizationId },
                team: job.teamId ? { uuid: job.teamId } : undefined,
                status: job.status,
                priority: job.priority,
                retryCount: job.retryCount,
                maxRetries: job.maxRetries,
                errorClassification: job.errorClassification,
                lastError: job.lastError,
                scheduledAt: job.scheduledAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                currentStage: job.currentStage,
                metadata: job.metadata,
            });

            const saved = await this.jobRepository.save(jobModel);

            return this.mapToInterface(saved);
        } catch (error) {
            this.logger.error({
                message: 'Failed to create workflow job',
                context: WorkflowJobRepository.name,
                error,
            });
            throw error;
        }
    }

    async findOne(jobId: string): Promise<IWorkflowJob | null> {
        const job = await this.jobRepository.findOne({
            where: { uuid: jobId },
            relations: ['organization', 'team'],
        });

        return job ? this.mapToInterface(job) : null;
    }

           async update(
               jobId: string,
               updates: Partial<IWorkflowJob>,
           ): Promise<IWorkflowJob | null> {
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
                       currentStage: updates.currentStage,
                       metadata: updates.metadata,
                       waitingForEvent: updates.waitingForEvent,
                   },
               );

               return this.findOne(jobId);
           }

    async findMany(filters: {
        status?: JobStatus;
        workflowType?: WorkflowType;
        organizationId?: string;
        teamId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ data: IWorkflowJob[]; total: number }> {
        const where: FindOptionsWhere<WorkflowJobModel> = {};

        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.workflowType) {
            where.workflowType = filters.workflowType;
        }
        if (filters.organizationId) {
            where.organization = { uuid: filters.organizationId };
        }
        if (filters.teamId) {
            where.team = { uuid: filters.teamId };
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
        history: Omit<IJobExecutionHistory, 'id' | 'jobId' | 'createdAt'>,
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
            createdAt: h.createdAt,
        }));
    }

    async count(filters: {
        status?: JobStatus;
        workflowType?: WorkflowType;
        organizationId?: string;
        teamId?: string;
    }): Promise<number> {
        const where: FindOptionsWhere<WorkflowJobModel> = {};

        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.workflowType) {
            where.workflowType = filters.workflowType;
        }
        if (filters.organizationId) {
            where.organization = { uuid: filters.organizationId };
        }
        if (filters.teamId) {
            where.team = { uuid: filters.teamId };
        }

        return await this.jobRepository.count({ where });
    }

    private mapToInterface(job: WorkflowJobModel): IWorkflowJob {
        return {
            id: job.uuid,
            correlationId: job.correlationId,
            workflowType: job.workflowType,
            handlerType: job.handlerType,
            payload: job.payload,
            organizationId: job.organization?.uuid || '',
            teamId: job.team?.uuid,
            status: job.status,
            priority: job.priority,
            retryCount: job.retryCount,
            maxRetries: job.maxRetries,
            errorClassification: job.errorClassification,
            lastError: job.lastError,
            scheduledAt: job.scheduledAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            currentStage: job.currentStage,
            metadata: job.metadata,
            waitingForEvent: job.waitingForEvent,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        };
    }
}

