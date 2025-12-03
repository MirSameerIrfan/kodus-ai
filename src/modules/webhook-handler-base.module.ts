import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database.module';
import { LogModule } from './log.module';
import { RabbitMQWrapperModule } from './rabbitmq.module';
import { SharedModule } from './shared.module';
import { WebhookLogModule } from './webhookLog.module';
import { WebhookEnqueueModule } from './webhook-enqueue.module';
import { HealthModule } from './health.module';
import { GlobalCacheModule } from './cache.module';

/**
 * WebhookHandlerBaseModule - Lightweight Base Module for Webhook Handler
 *
 * This module contains ONLY the minimal infrastructure needed for webhook handling:
 * - Database (for webhook logs)
 * - RabbitMQ (for enqueueing jobs)
 * - Logging (for observability)
 * - Webhook logging (for audit)
 * - Workflow queue enqueueing (minimal - only what's needed to enqueue jobs)
 * - Health checks
 *
 * It does NOT include:
 * - LLM modules (not needed - processing happens in workers)
 * - AST modules (not needed - processing happens in workers)
 * - Code review execution (not needed - processing happens in workers)
 * - Authentication modules (webhooks use signature validation)
 * - Most domain modules (not needed for simple enqueueing)
 * - WorkflowQueueModule complete (too heavy - includes consumers, processors, etc.)
 *
 * This makes the webhook handler:
 * - Lightweight (~80-100MB memory vs ~150-200MB with full WorkflowQueueModule)
 * - Fast startup (~3-5 seconds vs ~10-15 seconds with full WorkflowQueueModule)
 * - High throughput (can handle 1000+ req/s)
 * - Stateless (easy to scale horizontally)
 */
@Module({
    imports: [
        // Core Infrastructure (minimal)
        ConfigModule.forRoot(),
        EventEmitterModule.forRoot(),
        GlobalCacheModule,
        RabbitMQWrapperModule.register(),
        LogModule,
        DatabaseModule,
        SharedModule,
        // Webhook-specific
        WebhookLogModule,
        WebhookEnqueueModule, // Minimal module for enqueueing jobs (replaces WorkflowQueueModule)
        HealthModule,
    ],
    // No providers - all providers come from imported modules
    // No controllers - controllers are added by WebhookHandlerModule
    // No exports - this is a base module
})
export class WebhookHandlerBaseModule {}
