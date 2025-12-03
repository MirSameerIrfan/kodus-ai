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
import { PlatformIntegrationModule } from './platformIntegration.module';
import { GithubModule } from './github.module';
import { GitlabModule } from './gitlab.module';
import { BitbucketModule } from './bitbucket.module';
import { AzureReposModule } from './azureRepos.module';

/**
 * WebhookHandlerBaseModule - Lightweight Base Module for Webhook Handler
 *
 * This module contains ONLY the minimal infrastructure needed for webhook handling:
 * - Database (for webhook logs)
 * - RabbitMQ (for enqueueing jobs)
 * - Logging (for observability)
 * - Webhook logging (for audit)
 * - Workflow queue enqueueing (minimal - only what's needed to enqueue jobs)
 * - Platform integration modules (for webhook handlers and use cases)
 * - Health checks
 *
 * It does NOT include:
 * - LLM modules (not needed - processing happens in workers)
 * - AST modules (not needed - processing happens in workers)
 * - Code review execution (not needed - processing happens in workers)
 * - Authentication modules (webhooks use signature validation)
 * - Most domain modules (not needed for simple enqueueing)
 * - WorkflowQueueModule complete consumers/processors (workers handle this)
 *
 * NOTE: PlatformIntegrationModule imports WorkflowQueueModule complete, but it's not used
 * directly in the webhook handler (only EnqueueCodeReviewJobUseCase is used, which comes from
 * WebhookEnqueueModule). This is a pragmatic trade-off to avoid complex refactoring of handlers.
 *
 * This makes the webhook handler:
 * - Lightweight (~100-120MB memory vs ~150-200MB with full WorkflowQueueModule)
 * - Fast startup (~5-7 seconds vs ~10-15 seconds with full WorkflowQueueModule)
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
        // Platform Integration (for ReceiveWebhookUseCase and webhook handlers)
        PlatformIntegrationModule, // Provides ReceiveWebhookUseCase and webhook handlers (GitHubPullRequestHandler, etc.)
        GithubModule, // Provides GetOrganizationNameUseCase, GetIntegrationGithubUseCase
        GitlabModule, // Provides GitLab handlers and use cases
        BitbucketModule, // Provides Bitbucket handlers and use cases
        AzureReposModule, // Provides Azure Repos handlers and use cases
        HealthModule,
    ],
    // No providers - all providers come from imported modules
    // No controllers - controllers are added by WebhookHandlerModule
    // No exports - this is a base module
})
export class WebhookHandlerBaseModule {}
