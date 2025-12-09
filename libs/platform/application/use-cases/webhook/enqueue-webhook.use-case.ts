import { Injectable, Inject } from '@nestjs/common';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { PinoLoggerService } from '@libs/core/infrastructure/logging/pino.service';
import {
    IJobQueueService,
    JOB_QUEUE_SERVICE_TOKEN,
} from '@libs/workflow-queue/domain/contracts/job-queue.service.contract';
import { WorkflowType } from '@libs/workflow-queue/domain/enums/workflow-type.enum';
import { HandlerType } from '@libs/workflow-queue/domain/enums/handler-type.enum';
import { JobStatus } from '@libs/workflow-queue/domain/enums/job-status.enum';
import { v4 as uuid } from 'uuid';

export interface EnqueueWebhookInput {
    platformType: PlatformType | string;
    event: string;
    payload: Record<string, unknown>;
    correlationId?: string;
}

@Injectable()
export class EnqueueWebhookUseCase implements IUseCase {
    constructor(
        @Inject(JOB_QUEUE_SERVICE_TOKEN)
        private readonly jobQueueService: IJobQueueService,
        //TODO não usamos mais assim
        private readonly logger: PinoLoggerService,
    ) {}

    async execute(input: EnqueueWebhookInput): Promise<void> {
        try {
            const correlationId = input.correlationId || uuid();

            this.logger.log({
                message: 'Enqueuing raw webhook payload',
                context: EnqueueWebhookUseCase.name,
                metadata: {
                    correlationId,
                    platformType: input.platformType,
                    event: input.event,
                },
            });

            // Enfileira o payload bruto do webhook para processamento posterior pelo worker
            // organizationAndTeam será identificado pelo worker ao processar o webhook
            await this.jobQueueService.enqueue({
                correlationId,
                workflowType: WorkflowType.WEBHOOK_PROCESSING,
                handlerType: HandlerType.WEBHOOK_RAW,
                payload: input.payload,
                organizationAndTeam: undefined, // Será identificado pelo worker
                metadata: {
                    platformType: input.platformType,
                    event: input.event,
                },
                status: JobStatus.PENDING,
                priority: 0,
                retryCount: 0,
                maxRetries: 3,
            });

            this.logger.log({
                message: 'Raw webhook payload enqueued successfully',
                context: EnqueueWebhookUseCase.name,
                metadata: {
                    correlationId,
                    platformType: input.platformType,
                    event: input.event,
                },
            });
        } catch (error) {
            this.logger.error({
                message: 'Failed to enqueue raw webhook payload',
                context: EnqueueWebhookUseCase.name,
                error,
                metadata: {
                    input,
                },
            });
            throw error;
        }
    }
}
