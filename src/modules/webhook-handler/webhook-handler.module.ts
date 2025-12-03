import { Module } from '@nestjs/common';
import { WebhookHandlerBaseModule } from './webhook-handler-base.module';
import { GithubController } from '@/core/infrastructure/http/controllers/github.controller';
import { GitlabController } from '@/core/infrastructure/http/controllers/gitlab.controller';
import { BitbucketController } from '@/core/infrastructure/http/controllers/bitbucket.controller';
import { AzureReposController } from '@/core/infrastructure/http/controllers/azureRepos.controller';
import { WebhookHealthController } from '@/core/infrastructure/http/controllers/webhook-health.controller';

/**
 * WebhookHandlerModule - Módulo de Entrada para Webhook Handler
 *
 * Este módulo estende WebhookHandlerBaseModule (infraestrutura mínima) e adiciona:
 * - Apenas controllers de webhook (GitHub, GitLab, Bitbucket, Azure Repos)
 * - Health check endpoint
 * - SEM autenticação JWT (webhooks usam signature validation)
 * - Leve, stateless, otimizado para alta throughput
 *
 * IMPORTANTE: Este módulo é projetado para APENAS enfileirar webhooks, não processá-los.
 * Todo processamento pesado (LLM, AST, code review) acontece nos workers.
 *
 * Entry point: webhook-handler.ts (porta 3332)
 *
 * Memory footprint: ~10-20MB (vs ~100-120MB com módulos pesados)
 * Startup time: ~500ms-1s (vs ~5-7s com módulos pesados)
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
        WebhookHealthController,
    ],
    // No APP_GUARD - webhooks use signature validation instead of JWT
})
export class WebhookHandlerModule {}
