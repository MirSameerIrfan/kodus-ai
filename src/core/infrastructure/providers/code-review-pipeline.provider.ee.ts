/**
 * @license
 * Kodus Tech. All rights reserved.
 */
import { CodeReviewPipelineStrategyEE } from '@/ee/codeReview/strategies/code-review-pipeline.strategy.ee';
import { environment } from '@/ee/configs/environment';
import { createLogger } from '@kodus/flow';
import { Provider } from '@nestjs/common';
import { CodeReviewPipelineContext } from '../adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context';
import { CodeReviewPipelineStrategy } from '../adapters/services/codeBase/codeReviewPipeline/strategies/code-review-pipeline.strategy';
import { IPipeline } from '../adapters/services/pipeline/interfaces/pipeline.interface';
import { CodeReviewPipelineExecutor } from '../adapters/services/codeBase/codeReviewPipeline/pipeline/pipeline-executor.service';
import { PipelineStateManager } from '../adapters/services/codeBase/codeReviewPipeline/pipeline/pipeline-state-manager.service';

export const CODE_REVIEW_PIPELINE_TOKEN = 'CODE_REVIEW_PIPELINE';

export const codeReviewPipelineProvider: Provider = {
    provide: CODE_REVIEW_PIPELINE_TOKEN,
    useFactory: (
        ceStrategy: CodeReviewPipelineStrategy,
        eeStrategy: CodeReviewPipelineStrategyEE,
        pipelineExecutor: CodeReviewPipelineExecutor,
        stateManager: PipelineStateManager,
    ): IPipeline<CodeReviewPipelineContext> => {
        const isCloud = environment.API_CLOUD_MODE;
        const strategy = isCloud ? eeStrategy : ceStrategy;

        const logger = createLogger('CodeReviewPipelineProvider');
        logger.log({
            message: `🔁 Modo de execução: ${isCloud ? 'Cloud (EE)' : 'Self-Hosted (CE)'}`,
            context: 'CodeReviewPipelineProvider',
            metadata: {
                mode: isCloud ? 'cloud' : 'selfhosted',
            },
        });

        return {
            pipeLineName: 'CodeReviewPipeline',
            execute: async (
                context: CodeReviewPipelineContext,
            ): Promise<CodeReviewPipelineContext> => {
                const stages = strategy.configureStages();
                // Use the new CodeReviewPipelineExecutor with state persistence
                // Note: workflowJobId is optional for legacy code paths (CodeReviewHandlerService)
                // When called from workflow queue, workflowJobId will be set in context
                // Cast stages to Stage[] - all stages have been migrated to implement Stage interface
                return await pipelineExecutor.execute(
                    context,
                    stages as any[], // Cast needed due to type compatibility during migration
                    context.workflowJobId, // Pass workflowJobId if available
                );
            },
        };
    },
    inject: [
        CodeReviewPipelineStrategy,
        CodeReviewPipelineStrategyEE,
        CodeReviewPipelineExecutor,
        PipelineStateManager,
    ],
};
