import { CodeReviewPipelineContext } from '../../context/code-review-pipeline.context';
import { Stage } from './stage.interface';

/**
 * Interface for heavy stages that pause workflow execution
 * Heavy stages are event-driven and asynchronous
 */
export interface HeavyStage extends Stage {
    /**
     * Start the heavy stage execution
     * Publishes event and returns taskId/eventKey for tracking
     * @param context Current pipeline context
     * @returns Task ID or event key to track completion
     */
    start(context: CodeReviewPipelineContext): Promise<string>;

    /**
     * Get result of heavy stage execution
     * Called when event arrives indicating stage completion
     * Fetches the completed result from external service/storage
     * @param context Current pipeline context
     * @param taskId Task ID returned from start()
     * @returns Updated context with stage results
     */
    getResult(
        context: CodeReviewPipelineContext,
        taskId: string,
    ): Promise<CodeReviewPipelineContext>;

    /**
     * Resume heavy stage execution after pause
     * Called when workflow is resumed from WAITING_FOR_EVENT state
     * @param context Current pipeline context
     * @param taskId Task ID returned from start()
     */
    resume(
        context: CodeReviewPipelineContext,
        taskId: string,
    ): Promise<CodeReviewPipelineContext>;

    /**
     * Timeout in milliseconds for this heavy stage
     * If event doesn't arrive within timeout, workflow will retry or fail
     */
    timeout: number;

    /**
     * Event type to listen for (e.g., 'ast.task.completed')
     */
    eventType: string;
}
