export interface OutboxMessage {
    jobId: string;
    exchange: string;
    routingKey: string;
    payload: Record<string, unknown>;
}
