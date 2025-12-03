import { Module } from '@nestjs/common';
import { WebhookHandlerBaseModule } from './webhook-handler-base.module';
import { GithubController } from '@/core/infrastructure/http/controllers/github.controller';
import { GitlabController } from '@/core/infrastructure/http/controllers/gitlab.controller';
import { BitbucketController } from '@/core/infrastructure/http/controllers/bitbucket.controller';
import { AzureReposController } from '@/core/infrastructure/http/controllers/azureRepos.controller';
import { HealthController } from '@/core/infrastructure/http/controllers/health.controller';

/**
 * Webhook Handler Module
 *
 * This module extends WebhookHandlerBaseModule (lightweight infrastructure) and adds:
 * - Only webhook controllers (GitHub, GitLab, Bitbucket, Azure Repos)
 * - Health check endpoint
 * - NO JWT authentication (webhooks use signature validation)
 * - Lightweight, stateless, optimized for high throughput
 *
 * IMPORTANT: This module is designed to ONLY enqueue jobs, not process them.
 * All heavy processing (LLM, AST, code review) happens in workers.
 *
 * Entry point: webhook-handler.ts (porta 3332)
 *
 * Memory footprint: ~50-100MB (vs ~500MB+ with full AppModule)
 * Startup time: ~2-5 seconds (vs ~15-30 seconds with full AppModule)
 */
@Module({
    imports: [WebhookHandlerBaseModule],
    controllers: [
        // Webhook endpoints only
        GithubController,
        GitlabController,
        BitbucketController,
        AzureReposController,
        // Health check (no auth required)
        HealthController,
    ],
    // No APP_GUARD - webhooks use signature validation instead of JWT
})
export class WebhookHandlerModule {}
