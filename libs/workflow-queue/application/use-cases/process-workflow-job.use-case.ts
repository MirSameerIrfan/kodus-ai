import { Injectable, Inject } from '@nestjs/common';
import { IUseCase } from '@/shared/domain/interfaces/use-case.interface';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import {
    IJobProcessorService,
    JOB_PROCESSOR_SERVICE_TOKEN,
} from '@/core/domain/workflowQueue/contracts/job-processor.service.contract';
import { ObservabilityService } from '@/core/infrastructure/adapters/services/logger/observability.service';

export interface ProcessWorkflowJobInput {
    jobId: string;
}

@Injectable()
export class ProcessWorkflowJobUseCase implements IUseCase {
    constructor(
        @Inject(JOB_PROCESSOR_SERVICE_TOKEN)
        private readonly jobProcessor: IJobProcessorService,
        private readonly logger: PinoLoggerService,
        private readonly observability: ObservabilityService,
    ) {}

    async execute(input: ProcessWorkflowJobInput): Promise<void> {
        return await this.observability.runInSpan(
            'workflow.job.process.use-case',
            async (span) => {
                span.setAttributes({
                    'workflow.job.id': input.jobId,
                });

                this.logger.log({
                    message: 'Processing workflow job',
                    context: ProcessWorkflowJobUseCase.name,
                    metadata: {
                        jobId: input.jobId,
                    },
                });

                try {
                    await this.jobProcessor.process(input.jobId);

                    span.setAttributes({
                        'workflow.job.processed': true,
                    });

                    this.logger.log({
                        message: 'Workflow job processed successfully',
                        context: ProcessWorkflowJobUseCase.name,
                        metadata: {
                            jobId: input.jobId,
                        },
                    });
                } catch (error) {
                    span.setAttributes({
                        'error': true,
                        'exception.type': error.name,
                        'exception.message': error.message,
                    });

                    this.logger.error({
                        message: 'Failed to process workflow job',
                        context: ProcessWorkflowJobUseCase.name,
                        error,
                        metadata: {
                            jobId: input.jobId,
                        },
                    });

                    throw error;
                }
            },
            {
                'workflow.component': 'use-case',
                'workflow.operation': 'process_job',
            },
        );
    }
}
