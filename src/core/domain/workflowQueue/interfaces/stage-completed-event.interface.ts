/**
 * Event published when a heavy stage completes
 * Used to resume paused workflows waiting for stage completion
 */
export interface StageCompletedEvent {
    /**
     * Name of the stage that completed
     */
    stageName: string;

    /**
     * Event type (e.g., 'ast.task.completed')
     */
    eventType: string;

    /**
     * Event key (usually taskId) used to match with waiting workflows
     */
    eventKey: string;

    /**
     * Task ID returned from stage.start()
     */
    taskId: string;

    /**
     * Optional result data from stage execution
     */
    result?: Record<string, unknown>;

    /**
     * Optional metadata
     */
    metadata?: Record<string, unknown>;
}

