import { Module } from '@nestjs/common';
import { AppModule } from './app.module';
import { WorkflowQueueModule } from './workflowQueue.module';

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
    imports: [
        AppModule,
        WorkflowQueueModule, // Workers, consumers, processors
    ],
    // No controllers - workers don't expose HTTP endpoints
    // No APP_GUARD - workers don't handle HTTP requests
})
export class WorkerModule {}
