import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { IJobQueueService } from '@libs/core/workflow/domain/contracts/job-queue.service.contract';
import { IWorkflowJob } from '@libs/core/workflow/domain/interfaces/workflow-job.interface';

import { ObservabilityService } from '@libs/core/log/observability.service';
import { createLogger } from '@kodus/flow';

import { WorkflowJobRepository } from './repositories/workflow-job.repository';
import { OutboxMessageRepository } from './repositories/outbox-message.repository';
import {
    IMessageBrokerService,
    MESSAGE_BROKER_SERVICE_TOKEN,
} from '@libs/core/domain/contracts/message-broker.service.contracts';

@Injectable()
export class WorkflowJobQueueService implements IJobQueueService {
    private readonly logger = createLogger(WorkflowJobQueueService.name);

    constructor(
        @Inject(MESSAGE_BROKER_SERVICE_TOKEN)
        private readonly messageBroker: IMessageBrokerService,
        private readonly jobRepository: WorkflowJobRepository,
        private readonly outboxRepository: OutboxMessageRepository,
        private readonly dataSource: DataSource,
        private readonly observability: ObservabilityService,
    ) {}

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

                // Transactional creation of Job and Outbox Message
                const jobToSave = await this.dataSource.transaction(
                    async (transactionManager) => {
                        // 1. Create Job in transaction
                        const savedJob = await this.jobRepository.create(
                            job,
                            transactionManager,
                        );

                        const payload = {
                            jobId: savedJob.uuid,
                            correlationId: job.correlationId,
                            workflowType: job.workflowType,
                            handlerType: job.handlerType,
                            organizationId:
                                job.organizationAndTeam?.organizationId,
                            teamId: job.organizationAndTeam?.teamId,
                        };

                        // 2. Prepare Message Envelope
                        const messagePayload =
                            this.messageBroker.transformMessageToMessageBroker(
                                'workflow.jobs.created',
                                payload,
                                1,
                                new Date(),
                            );

                        // Override messageId to match job UUID for consistency/tracing
                        messagePayload.messageId = savedJob.uuid;

                        // Define exchange and routing key explicitly
                        const exchange = 'workflow.exchange';
                        const routingKey = `workflow.jobs.created`;

                        // 3. Create Outbox Message in transaction
                        await this.outboxRepository.create(
                            {
                                jobId: savedJob.uuid,
                                exchange: exchange,
                                routingKey: routingKey,
                                payload: messagePayload as unknown as Record<
                                    string,
                                    unknown
                                >,
                            },
                            transactionManager,
                        );

                        this.logger.log({
                            message:
                                'Workflow job and outbox message created (Transactional)',
                            context: WorkflowJobQueueService.name,
                            metadata: {
                                jobId: savedJob.uuid,
                                correlationId: job.correlationId,
                                workflowType: job.workflowType,
                            },
                        });

                        return savedJob;
                    },
                );

                span.setAttributes({
                    'workflow.job.id': jobToSave.uuid,
                });

                return jobToSave.uuid;
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
