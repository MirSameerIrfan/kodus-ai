import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { IJobQueueService } from '@libs/core/workflow/domain/contracts/job-queue.service.contract';
import { IWorkflowJob } from '@libs/core/workflow/domain/interfaces/workflow-job.interface';

import { TransactionalOutboxService } from './transactional-outbox.service';
import { ObservabilityService } from '@libs/core/log/observability.service';
import { createLogger } from '@kodus/flow';

import { WorkflowJobRepository } from './repositories/workflow-job.repository';

@Injectable()
export class RabbitMQJobQueueService implements IJobQueueService {
    private readonly exchange = 'workflow.exchange';
    private readonly routingKey = 'workflow.jobs.created';
    private readonly logger = createLogger(RabbitMQJobQueueService.name);

    constructor(
        @Optional() private readonly amqpConnection: AmqpConnection,
        private readonly jobRepository: WorkflowJobRepository,
        private readonly outboxService: TransactionalOutboxService,
        private readonly dataSource: DataSource,
        private readonly observability: ObservabilityService,
    ) {
        if (!amqpConnection) {
            this.logger.warn({
                message: 'RabbitMQ is not configured or available.',
                context: RabbitMQJobQueueService.name,
            });
        }
    }

    async enqueue(
        job: Omit<IWorkflowJob, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<string> {
        return await this.observability.runInSpan(
            'workflow.job.enqueue',
            async (span) => {
                span.setAttributes({
                    'workflow.job.type': job.workflowType,
                    'workflow.job.handler': job.handlerType,
                    'workflow.correlation.id': job.correlationId,
                });

                // Usa Transactional Outbox pattern
                const savedJob = await this.dataSource.transaction(
                    async (manager) => {
                        // 1. Salva job no banco
                        const jobToSave = await this.jobRepository.create(job);

                        // 2. Salva mensagem no outbox (mesma transação)
                        await this.outboxService.saveInTransaction(manager, {
                            jobId: jobToSave.uuid,
                            exchange: this.exchange,
                            routingKey: `${this.routingKey}.${job.workflowType.toLowerCase()}`,
                            payload: {
                                jobId: jobToSave.uuid,
                                correlationId: job.correlationId,
                                workflowType: job.workflowType,
                                handlerType: job.handlerType,
                                organizationId:
                                    job.organizationAndTeam?.organizationId,
                                teamId: job.organizationAndTeam?.teamId,
                            },
                        });

                        return jobToSave;
                    },
                );

                span.setAttributes({
                    'workflow.job.id': savedJob.uuid,
                });

                this.logger.log({
                    message: 'Workflow job enqueued via transactional outbox',
                    context: RabbitMQJobQueueService.name,
                    metadata: {
                        jobId: savedJob.uuid,
                        correlationId: job.correlationId,
                        workflowType: job.workflowType,
                        handlerType: job.handlerType,
                    },
                });

                return savedJob.uuid;
            },
            {
                'workflow.component': 'queue',
                'workflow.operation': 'enqueue',
            },
        );
    }

    async getStatus(jobId: string): Promise<IWorkflowJob | null> {
        return await this.jobRepository.findOne(jobId);
    }

    async listJobs(filters: {
        status?: any;
        workflowType?: any;
        organizationId?: string;
        teamId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: IWorkflowJob[];
        total: number;
        limit: number;
        offset: number;
    }> {
        const result = await this.jobRepository.findMany({
            status: filters.status,
            workflowType: filters.workflowType,
            organizationId: filters.organizationId,
            teamId: filters.teamId,
            limit: filters.limit,
            offset: filters.offset,
        });

        return {
            data: result.data,
            total: result.total,
            limit: filters.limit || 50,
            offset: filters.offset || 0,
        };
    }
}
