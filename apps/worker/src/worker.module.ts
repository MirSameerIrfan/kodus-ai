import { Module } from '@nestjs/common';

/**
 * Worker Module
 *
 * This module extends AppModule (base shared infrastructure) and adds:
 * - WorkflowQueueModule (consumers, processors, relay services)
 * - NO HTTP controllers (no HTTP server)
 * - RabbitMQ consumers for job processing
 * - Outbox relay service for publishing messages
 *
 * Entry point: worker.ts (sem HTTP, apenas processamento)
 */
@Module({
    imports: [],
    // No controllers - workers don't expose HTTP endpoints
    // No APP_GUARD - workers don't handle HTTP requests
})
export class WorkerModule {}
