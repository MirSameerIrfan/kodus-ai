import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';
import { CodeReviewPipelineContext } from '../codeBase/codeReviewPipeline/context/code-review-pipeline.context';
import { IPipeline } from '../pipeline/interfaces/pipeline.interface';
import { PipelineExecutor } from '../pipeline/pipeline-executor.service';
import { DryRunCodeReviewPipelineStrategy } from './dry-run-cr-pipeline.strategy';

@Injectable()
export class DryRunCodeReviewPipeline
    implements IPipeline<CodeReviewPipelineContext>
{
    private readonly logger = createLogger(DryRunCodeReviewPipeline.name);
    pipeLineName: string = 'DryRunCodeReviewPipeline';

    constructor(
        private readonly dryRunCodeReviewPipelineStrategy: DryRunCodeReviewPipelineStrategy,
    ) {}

    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        const stages = this.dryRunCodeReviewPipelineStrategy.configureStages();
        const executor = new PipelineExecutor();

        const result = await executor.execute(
            context,
            stages,
            this.dryRunCodeReviewPipelineStrategy.getPipelineName(),
        );

        return result as CodeReviewPipelineContext;
    }
}
