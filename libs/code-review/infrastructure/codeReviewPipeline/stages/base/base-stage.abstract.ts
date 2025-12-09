import { produce } from 'immer';

import { Stage } from './stage.interface';
import { CodeReviewPipelineContext } from '../../context/code-review-pipeline.context';
import { CodeReviewPipelineExecutor } from '../../pipeline/pipeline-executor.service';

/**
 * Base abstract class for stages
 * Provides common functionality and helper methods
 */
export abstract class BaseStage implements Stage {
    abstract name: string;
    abstract dependsOn?: string[];

    /**
     * Execute the stage
     * Must be implemented by subclasses
     */
    abstract execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext>;

    /**
     * Check if this is a light stage
     * Default implementation returns true (light stage)
     * Override in HeavyStage implementations to return false
     */
    isLight(): boolean {
        return true;
    }

    /**
     * Optional: Check if stage can execute
     * Default implementation always returns true
     */
    canExecute?(
        context: CodeReviewPipelineContext,
    ): Promise<boolean> | boolean {
        return true;
    }

    /**
     * Optional: Compensate for stage execution
     * Default implementation does nothing
     */
    compensate?(context: CodeReviewPipelineContext): Promise<void> {
        // No-op by default
    }

    /**
     * Helper method to update context using immer
     * Provides type-safe way to update context properties immutably
     */
    protected updateContext(
        context: CodeReviewPipelineContext,
        updater: (draft: CodeReviewPipelineContext) => void,
    ): CodeReviewPipelineContext {
        return produce(context, updater);
    }

    /**
     * Helper method to execute sub-pipelines
     * Used when a stage needs to execute nested pipelines
     */
    protected async executeSubPipeline(
        subContext: CodeReviewPipelineContext,
        stages: Stage[],
        pipelineName: string,
        pipelineExecutor: CodeReviewPipelineExecutor,
    ): Promise<CodeReviewPipelineContext> {
        try {
            return await pipelineExecutor.execute(
                subContext,
                stages,
                pipelineName,
                subContext.pipelineMetadata?.parentPipelineId,
                subContext.pipelineMetadata?.rootPipelineId,
            );
        } catch (error) {
            subContext?.errors?.push({
                pipelineId: subContext?.pipelineMetadata?.pipelineId,
                stage: this.name,
                substage: pipelineName,
                error,
            });
            throw error;
        }
    }
}
