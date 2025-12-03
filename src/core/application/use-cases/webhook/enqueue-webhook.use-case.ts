import { Injectable, Inject } from '@nestjs/common';
import { IUseCase } from '@/shared/domain/interfaces/use-case.interface';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import {
    IJobQueueService,
    JOB_QUEUE_SERVICE_TOKEN,
} from '@/core/domain/workflowQueue/contracts/job-queue.service.contract';
import { WorkflowType } from '@/core/domain/workflowQueue/enums/workflow-type.enum';
import { HandlerType } from '@/core/domain/workflowQueue/enums/handler-type.enum';
import { JobStatus } from '@/core/domain/workflowQueue/enums/job-status.enum';
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
            // organizationId e teamId serão identificados pelo worker ao processar o webhook
            await this.jobQueueService.enqueue({
                correlationId,
                workflowType: WorkflowType.WEBHOOK_PROCESSING,
                handlerType: HandlerType.WEBHOOK_RAW,
                payload: input.payload,
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
