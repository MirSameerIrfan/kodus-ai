/**
 * @license
 * Kodus Tech. All rights reserved.
 */
import { CodeReviewPipelineContext } from '@libs/code-review/infrastructure/context/code-review-pipeline.context';
import { PipelineContext } from '@libs/core/infrastructure/pipeline/interfaces/pipeline-context.interface';
import { IPipeline } from '@libs/core/infrastructure/pipeline/interfaces/pipeline.interface';
import { PipelineFactory } from '@libs/code-review/infrastructure/pipeline/pipeline-factory.service';
import { PinoLoggerService } from '@libs/core/log/pino.service';
import { Provider } from '@nestjs/common';

export const PIPELINE_PROVIDER_TOKEN = 'PIPELINE_PROVIDER';

export const pipelineProvider: Provider = {
    provide: PIPELINE_PROVIDER_TOKEN,
    useFactory: (
        codeReviewPipeline: IPipeline<CodeReviewPipelineContext>,
        dryRunPipeline: IPipeline<CodeReviewPipelineContext>,
        logger: PinoLoggerService,
    ): PipelineFactory<PipelineContext> => {
        const factory = new PipelineFactory<PipelineContext>([
            codeReviewPipeline,
            dryRunPipeline,
        ]);
        return factory;
    },
    inject: [CODE_REVIEW_PIPELINE_TOKEN, PinoLoggerService],
};
