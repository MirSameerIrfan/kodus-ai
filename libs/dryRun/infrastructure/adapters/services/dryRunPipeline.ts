import { Injectable } from '@nestjs/common';

import { CodeReviewPipelineContext } from '@libs/code-review/infrastructure/context/code-review-pipeline.context';
import { IPipeline } from '@libs/core/infrastructure/pipeline/interfaces/pipeline.interface';
import { PipelineExecutor } from '@libs/core/infrastructure/pipeline/services/pipeline-executor.service';

import { DryRunCodeReviewPipelineStrategy } from './dry-run-cr-pipeline.strategy';
import { PinoLoggerService } from '@libs/core/log/pino.service';

@Injectable()
export class DryRunCodeReviewPipeline
    implements IPipeline<CodeReviewPipelineContext>
{
    pipeLineName: string = 'DryRunCodeReviewPipeline';

    constructor(
        private readonly dryRunCodeReviewPipelineStrategy: DryRunCodeReviewPipelineStrategy,
        private readonly logger: PinoLoggerService,
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
