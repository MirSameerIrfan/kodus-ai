import { Module } from '@nestjs/common';

import { AIEngineModule } from '@libs/ai-engine/ai-engine.module';
import { AnalyticsModule } from '@libs/analytics/analytics.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { WorkflowModule } from '@libs/core/workflow/workflow.module';
import { DryRunModule } from '@libs/dryRun/dry-run.module';
import { AuthModule } from '@libs/identity/modules/auth.module';
import { UsersModule } from '@libs/identity/modules/user.module';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { IssuesModule } from '@libs/issues/issues.module';
import { KodyRulesModule } from '@libs/kodyRules/kody-rules.module';
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';

import { SharedMongoModule } from '@libs/shared/database/shared-mongo.module';
import { SharedPostgresModule } from '@libs/shared/database/shared-postgres.module';
import { SharedConfigModule } from '@libs/shared/infrastructure/shared-config.module';
import { SharedLogModule } from '@libs/shared/infrastructure/shared-log.module';
import { SharedObservabilityModule } from '@libs/shared/infrastructure/shared-observability.module';

import { AgentController } from './controllers/agent.controller';
import { CodeReviewSettingLogController } from './controllers/codeReviewSettingLog.controller';
import { DryRunController } from './controllers/dryRun.controller';
import { HealthController } from './controllers/health.controller';
import { KodyRulesController } from './controllers/kodyRules.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { PullRequestMessagesController } from './controllers/pullRequestMessages.controller';
import { RuleLikeController } from './controllers/ruleLike.controller';
import { SegmentController } from './controllers/segment.controller';
import { TokenUsageController } from './controllers/tokenUsage.controller';
import { WorkflowQueueController } from './controllers/workflow-queue.controller';
import { CodeManagementController } from './controllers/codeManagement.controller';
import { ParametersController } from './controllers/parameters.controller';
import { OrganizationController } from './controllers/organization.controller';

/**
 * API REST Module
 *
 * This module extends AppModule (base shared infrastructure) and adds:
 * - All HTTP controllers for API REST endpoints (dashboard, admin, etc.)
 * - Platform controllers (GitHub, GitLab, Bitbucket, Azure Repos) - includes both API and webhook endpoints
 * - JWT authentication guard
 * - Rate limiting, CORS, etc. (configured in main.ts)
 *
 * Entry point: main.ts (porta 3331)
 */
@Module({
    imports: [
        SharedConfigModule,
        SharedLogModule,
        SharedObservabilityModule,
        SharedPostgresModule.forRoot({ poolSize: 25 }),
        SharedMongoModule.forRoot(),

        AuthModule,
        UsersModule,
        KodyRulesModule,
        IssuesModule,
        OrganizationModule,
        WorkflowModule.register({ type: 'api' }),
        PlatformModule,
        AIEngineModule,
        CodeReviewModule,
        PullRequestsModule,
        PullRequestMessagesModule,
        IntegrationModule,
        IntegrationConfigModule,
        DryRunModule,
        AnalyticsModule,
        CodeReviewSettingsLogModule,
    ],
    controllers: [
        // Health
        HealthController,
        // Workflow Queue API
        WorkflowQueueController,
        // Platform Integration
        CodeManagementController,

        // Code Review
        DryRunController,
        CodeReviewSettingLogController,
        PullRequestMessagesController,

        // Kody Rules
        KodyRulesController,
        RuleLikeController,

        // Organization
        OrganizationController,
        OrganizationParametersController,
        ParametersController,
        TeamController,
        TeamMembersController,

        // Agent
        AgentController,
        // Other
        SegmentController,
        TokenUsageController,
        PermissionsController,
    ],
})
export class ApiModule {}
