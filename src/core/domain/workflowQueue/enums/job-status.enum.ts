export enum JobStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    WAITING_FOR_EVENT = 'WAITING_FOR_EVENT', // Workflow paused waiting for external event
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    RETRYING = 'RETRYING',
    CANCELLED = 'CANCELLED',
}
