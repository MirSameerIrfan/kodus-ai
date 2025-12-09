import { CodeReviewPipelineContext } from '@libs/code-review/infrastructure/context/code-review-pipeline.context';
import { IPipeline } from '@libs/code-review/infrastructure/pipeline/interfaces/pipeline.interface';
import { Injectable } from '@nestjs/common';
import { DryRunCodeReviewPipelineStrategy } from './dry-run-cr-pipeline.strategy';
import { PinoLoggerService } from '@libs/core/infrastructure/logging/pino.service';
import { PipelineExecutor } from '@libs/code-review/infrastructure/pipeline/pipeline-executor.service';

@Injectable()
export class DryRunCodeReviewPipeline implements IPipeline<CodeReviewPipelineContext> {
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
