/**
 * @license
 * Kodus Tech. All rights reserved.
 */
import { Provider } from '@nestjs/common';
import { CodeReviewPipelineContext } from '../adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context';
import { PipelineContext } from '../adapters/services/pipeline/interfaces/pipeline-context.interface';
import { IPipeline } from '../adapters/services/pipeline/interfaces/pipeline.interface';
import { PipelineFactory } from '../adapters/services/pipeline/pipeline-factory.service';
import { CODE_REVIEW_PIPELINE_TOKEN } from './code-review-pipeline.provider.ee';

export const PIPELINE_PROVIDER_TOKEN = 'PIPELINE_PROVIDER';

export const pipelineProvider: Provider = {
    provide: PIPELINE_PROVIDER_TOKEN,
    useFactory: (
        codeReviewPipeline: IPipeline<CodeReviewPipelineContext>,
        dryRunPipeline: IPipeline<CodeReviewPipelineContext>,
    ): PipelineFactory<PipelineContext> => {
        const factory = new PipelineFactory<PipelineContext>([
            codeReviewPipeline,
            dryRunPipeline,
        ]);
        return factory;
    },
    inject: [CODE_REVIEW_PIPELINE_TOKEN],
};
