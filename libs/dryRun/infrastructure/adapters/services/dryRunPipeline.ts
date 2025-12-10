import { Injectable } from '@nestjs/common';

import { CodeReviewPipelineContext } from '@libs/code-review/pipeline/context/code-review-pipeline.context';
import { IPipeline } from '@libs/core/infrastructure/pipeline/interfaces/pipeline.interface';
import { PipelineExecutor } from '@libs/core/infrastructure/pipeline/services/pipeline-executor.service';

import { DryRunCodeReviewPipelineStrategy } from './dry-run-cr-pipeline.strategy';
import { createLogger } from '@kodus/flow';

@Injectable()
export class DryRunCodeReviewPipeline
    implements IPipeline<CodeReviewPipelineContext>
{
    pipeLineName: string = 'DryRunCodeReviewPipeline';

    private readonly logger = createLogger(DryRunCodeReviewPipeline.name);

    constructor(
        private readonly dryRunCodeReviewPipelineStrategy: DryRunCodeReviewPipelineStrategy,
    ) {}

    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        const stages = this.dryRunCodeReviewPipelineStrategy.configureStages();
        const executor = new PipelineExecutor(this.logger);

        const result = await executor.execute(
            context,
            stages,
            this.dryRunCodeReviewPipelineStrategy.getPipelineName(),
        );

        return result as CodeReviewPipelineContext;
    }
}
