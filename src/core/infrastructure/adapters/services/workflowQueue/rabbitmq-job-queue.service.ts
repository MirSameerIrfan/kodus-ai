import { Injectable, Inject, Optional } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { IJobQueueService } from '@/core/domain/workflowQueue/contracts/job-queue.service.contract';
import { ICodeReviewJob } from '@/core/domain/workflowQueue/interfaces/code-review-job.interface';
import { CodeReviewJobRepository } from '@/core/infrastructure/adapters/repositories/typeorm/code-review-job.repository';
import { v4 as uuid } from 'uuid';
import { DataSource } from 'typeorm';

@Injectable()
export class RabbitMQJobQueueService implements IJobQueueService {
    private readonly exchange = 'code-review.exchange';
    private readonly queue = 'code-review.jobs.queue';
    private readonly routingKey = 'code-review.job.created';

    constructor(
        @Optional() private readonly amqpConnection: AmqpConnection,
        private readonly jobRepository: CodeReviewJobRepository,
        private readonly dataSource: DataSource,
        private readonly logger: PinoLoggerService,
    ) {
        if (!amqpConnection) {
            this.logger.warn({
                message: 'RabbitMQ is not configured or available.',
                context: RabbitMQJobQueueService.name,
            });
        }
    }

    async enqueue(
        job: Omit<ICodeReviewJob, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<string> {
        const jobId = uuid();

        // Usa Transactional Outbox pattern
        await this.dataSource.transaction(async (manager) => {
            // 1. Salva job no banco
            const savedJob = await this.jobRepository.create(job);

            // 2. Salva mensagem no outbox (mesma transação)
            await manager.query(
                `INSERT INTO outbox_messages (id, message_type, payload, status, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [
                    uuid(),
                    this.routingKey,
                    JSON.stringify({
                        jobId: savedJob.id,
                        correlationId: job.correlationId,
                        platformType: job.platformType,
                        repositoryId: job.repositoryId,
                        pullRequestNumber: job.pullRequestNumber,
                        organizationId: job.organizationId,
                        teamId: job.teamId,
                    }),
                    'pending',
                ],
            );
        });

        this.logger.log({
            message: 'Job enqueued via transactional outbox',
            context: RabbitMQJobQueueService.name,
            metadata: {
                jobId,
                correlationId: job.correlationId,
            },
        });

        return jobId;
    }

    async getStatus(jobId: string): Promise<ICodeReviewJob | null> {
        return await this.jobRepository.findOne(jobId);
    }

    async listJobs(filters: {
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
    }> {
        const result = await this.jobRepository.findMany({
            ...filters,
            status: filters.status as any,
        });

        return {
            data: result.data,
            total: result.total,
            limit: filters.limit || 50,
            offset: filters.offset || 0,
        };
    }
}
