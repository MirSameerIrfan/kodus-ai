import { CodeReviewPipelineContext } from '../../context/code-review-pipeline.context';

/**
 * Interface for pipeline stages
 * All stages must implement this interface
 */
export interface Stage {
    /**
     * Unique name of the stage
     */
    name: string;

    /**
     * Optional dependencies - stages that must execute before this one
     */
    dependsOn?: string[];

    /**
     * Execute the stage
     * @param context Current pipeline context
     * @returns Updated context
     */
    execute(context: CodeReviewPipelineContext): Promise<CodeReviewPipelineContext>;

    /**
     * Check if this is a light stage (fast, synchronous)
     * Light stages execute immediately without pausing the workflow
     * Heavy stages pause the workflow and resume via events
     */
    isLight(): boolean;

    /**
     * Optional: Check if stage can execute
     * @param context Current pipeline context
     * @returns true if stage can execute, false otherwise
     */
    canExecute?(context: CodeReviewPipelineContext): Promise<boolean> | boolean;

    /**
     * Optional: Compensate for stage execution (rollback)
     * Called when stage fails and needs to undo changes
     * @param context Current pipeline context
     */
    compensate?(context: CodeReviewPipelineContext): Promise<void>;
}

