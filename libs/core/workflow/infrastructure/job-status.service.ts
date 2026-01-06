import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { IJobStatusService } from '@libs/core/workflow/domain/contracts/job-status.service.contract';
import { JobStatus } from '@libs/core/workflow/domain/enums/job-status.enum';
import {
    IInboxMessageRepository,
    INBOX_MESSAGE_REPOSITORY_TOKEN,
} from '@libs/core/workflow/domain/contracts/inbox-message.repository.contract';
import {
    IOutboxMessageRepository,
    OUTBOX_MESSAGE_REPOSITORY_TOKEN,
} from '@libs/core/workflow/domain/contracts/outbox-message.repository.contract';

import { WorkflowJobRepository } from './repositories/workflow-job.repository';
import { createLogger } from '@kodus/flow';

@Injectable()
export class JobStatusService implements IJobStatusService {
    private readonly logger = createLogger(JobStatusService.name);

    constructor(
        private readonly jobRepository: WorkflowJobRepository,
        private readonly dataSource: DataSource,
        @Inject(INBOX_MESSAGE_REPOSITORY_TOKEN)
        private readonly inboxRepository: IInboxMessageRepository,
        @Inject(OUTBOX_MESSAGE_REPOSITORY_TOKEN)
        private readonly outboxRepository: IOutboxMessageRepository,
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
        // Busca métricas agregadas do banco (schema workflow)
        const queueSize = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM workflow.workflow_jobs WHERE status = $1`,
            [JobStatus.PENDING],
        );

        const processingCount = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM workflow.workflow_jobs WHERE status = $1`,
            [JobStatus.PROCESSING],
        );

        const completedToday = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM workflow.workflow_jobs
             WHERE status = $1 AND "completedAt" >= CURRENT_DATE`,
            [JobStatus.COMPLETED],
        );

        const failedToday = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM workflow.workflow_jobs
             WHERE status = $1 AND "completedAt" >= CURRENT_DATE`,
            [JobStatus.FAILED],
        );

        const avgProcessingTime = await this.dataSource.query(
            `SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) * 1000) as avg_ms
             FROM workflow.workflow_jobs
             WHERE status = $1 AND "completedAt" IS NOT NULL AND "startedAt" IS NOT NULL
             AND "completedAt" >= CURRENT_DATE`,
            [JobStatus.COMPLETED],
        );

        const byStatus = await this.dataSource.query(
            `SELECT status, COUNT(*) as count
             FROM workflow.workflow_jobs
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

    /**
     * Comprehensive health check for the entire workflow system
     * Includes inbox, outbox, and job metrics
     */
    async getWorkflowHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        timestamp: Date;
        inbox: {
            ready: number;
            processing: number;
            processed: number;
            failed: number;
            oldestProcessing?: Date;
            oldestAge?: number; // minutes
        };
        outbox: {
            ready: number;
            processing: number;
            sent: number;
            failed: number;
        };
        jobs: {
            pending: number;
            processing: number;
            completed: number;
            failed: number;
        };
        alerts: string[];
    }> {
        try {
            const [inboxStats, outboxStats, jobStats] = await Promise.all([
                this.inboxRepository.getHealthStats(),
                this.getOutboxStats(),
                this.getJobStats(),
            ]);

            const alerts: string[] = [];
            let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

            // Check inbox health
            if (inboxStats.processing > 100) {
                alerts.push(
                    `High inbox processing count: ${inboxStats.processing}`,
                );
                status = 'degraded';
            }

            if (inboxStats.oldestProcessing) {
                const oldestAge = Math.floor(
                    (Date.now() - inboxStats.oldestProcessing.getTime()) /
                        60000,
                );
                if (oldestAge > 60) {
                    // > 1h
                    alerts.push(
                        `Oldest inbox message: ${oldestAge} minutes old`,
                    );
                    status = 'degraded';
                }
                if (oldestAge > 180) {
                    // > 3h
                    status = 'unhealthy';
                }
            }

            // Check outbox health
            if (outboxStats.ready > 500) {
                alerts.push(`High outbox queue: ${outboxStats.ready} messages`);
                status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
            }

            // Check job health
            if (jobStats.failed > 50) {
                alerts.push(`High job failure count: ${jobStats.failed}`);
                status = 'degraded';
            }

            return {
                status,
                timestamp: new Date(),
                inbox: {
                    ...inboxStats,
                    oldestAge: inboxStats.oldestProcessing
                        ? Math.floor(
                              (Date.now() -
                                  inboxStats.oldestProcessing.getTime()) /
                                  60000,
                          )
                        : undefined,
                },
                outbox: outboxStats,
                jobs: jobStats,
                alerts,
            };
        } catch (error) {
            this.logger.error({
                message: 'Failed to get workflow health',
                context: JobStatusService.name,
                error,
            });
            return {
                status: 'unhealthy',
                timestamp: new Date(),
                inbox: {
                    ready: 0,
                    processing: 0,
                    processed: 0,
                    failed: 0,
                },
                outbox: { ready: 0, processing: 0, sent: 0, failed: 0 },
                jobs: { pending: 0, processing: 0, completed: 0, failed: 0 },
                alerts: ['Health check failed: ' + error.message],
            };
        }
    }

    private async getOutboxStats(): Promise<{
        ready: number;
        processing: number;
        sent: number;
        failed: number;
    }> {
        const result = await this.dataSource.query(
            `SELECT status, COUNT(*) as count
             FROM kodus_workflow.outbox_messages
             GROUP BY status`,
        );

        const stats = { ready: 0, processing: 0, sent: 0, failed: 0 };
        result.forEach((row: { status: string; count: string }) => {
            const count = parseInt(row.count);
            switch (row.status) {
                case 'READY':
                    stats.ready = count;
                    break;
                case 'PROCESSING':
                    stats.processing = count;
                    break;
                case 'SENT':
                    stats.sent = count;
                    break;
                case 'FAILED':
                    stats.failed = count;
                    break;
            }
        });

        return stats;
    }

    private async getJobStats(): Promise<{
        pending: number;
        processing: number;
        completed: number;
        failed: number;
    }> {
        const result = await this.dataSource.query(
            `SELECT status, COUNT(*) as count
             FROM kodus_workflow.workflow_jobs
             WHERE "createdAt" > NOW() - INTERVAL '24 hours'
             GROUP BY status`,
        );

        const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
        result.forEach((row: { status: string; count: string }) => {
            const count = parseInt(row.count);
            switch (row.status) {
                case 'PENDING':
                    stats.pending = count;
                    break;
                case 'PROCESSING':
                    stats.processing = count;
                    break;
                case 'COMPLETED':
                    stats.completed = count;
                    break;
                case 'FAILED':
                    stats.failed = count;
                    break;
            }
        });

        return stats;
    }
}
