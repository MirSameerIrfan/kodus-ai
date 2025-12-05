/**
 * Error thrown when a heavy stage pauses workflow execution
 * Workflow will be set to WAITING_FOR_EVENT status and resumed when event arrives
 */
export class WorkflowPausedError extends Error {
    constructor(
        public readonly eventType: string,
        public readonly eventKey: string,
        public readonly stageName: string,
        public readonly taskId: string,
        public readonly timeout: number,
        public readonly context?: Record<string, unknown>,
        message?: string,
    ) {
        super(
            message ||
                `Workflow paused at stage ${stageName} waiting for event ${eventType} with key ${eventKey}`,
        );
        this.name = 'WorkflowPausedError';

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, WorkflowPausedError);
        }
    }
}

