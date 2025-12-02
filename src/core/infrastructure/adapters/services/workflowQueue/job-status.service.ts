import { Injectable } from '@nestjs/common';
import { IJobStatusService } from '@/core/domain/workflowQueue/contracts/job-status.service.contract';
import { CodeReviewJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/code-review-job.repository';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
import { DataSource } from 'typeorm';

@Injectable()
export class JobStatusService implements IJobStatusService {
    constructor(
        private readonly jobRepository: CodeReviewJobRepository,
        private readonly dataSource: DataSource,
    ) {}

    async getJobStatus(jobId: string) {
        return await this.jobRepository.findOne(jobId);
    }

    async getJobDetail(jobId: string) {
        const job = await this.jobRepository.findOne(jobId);

        if (!job) {
            return null;
        }

        const executionHistory =
            await this.jobRepository.getExecutionHistory(jobId);

        return {
            job,
            executionHistory,
        };
    }

    async getMetrics() {
        // Busca métricas agregadas do banco
        const queueSize = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM code_review_jobs WHERE status = $1`,
            [JobStatus.PENDING],
        );

        const processingCount = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM code_review_jobs WHERE status = $1`,
            [JobStatus.PROCESSING],
        );

        const completedToday = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM code_review_jobs
             WHERE status = $1 AND completed_at >= CURRENT_DATE`,
            [JobStatus.COMPLETED],
        );

        const failedToday = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM code_review_jobs
             WHERE status = $1 AND completed_at >= CURRENT_DATE`,
            [JobStatus.FAILED],
        );

        const avgProcessingTime = await this.dataSource.query(
            `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_ms
             FROM code_review_jobs
             WHERE status = $1 AND completed_at IS NOT NULL AND started_at IS NOT NULL
             AND completed_at >= CURRENT_DATE`,
            [JobStatus.COMPLETED],
        );

        const byStatus = await this.dataSource.query(
            `SELECT status, COUNT(*) as count
             FROM code_review_jobs
             GROUP BY status`,
        );

        const totalCompleted = parseInt(completedToday[0]?.count || '0');
        const totalFailed = parseInt(failedToday[0]?.count || '0');
        const total = totalCompleted + totalFailed;
        const successRate = total > 0 ? (totalCompleted / total) * 100 : 100;

        return {
            queueSize: parseInt(queueSize[0]?.count || '0'),
            processingCount: parseInt(processingCount[0]?.count || '0'),
            completedToday: totalCompleted,
            failedToday: totalFailed,
            averageProcessingTime: parseFloat(
                avgProcessingTime[0]?.avg_ms || '0',
            ),
            successRate,
            byStatus: byStatus.reduce(
                (acc: Record<string, number>, row: any) => {
                    acc[row.status] = parseInt(row.count);
                    return acc;
                },
                {},
            ),
        };
    }
}
