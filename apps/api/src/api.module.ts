import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { Module } from '@nestjs/common';

import { AIEngineModule } from '@libs/ai-engine/modules/ai-engine.module';
import { AnalyticsModule } from '@libs/analytics/modules/analytics.module';
import { AgentsModule } from '@libs/agents/modules/agents.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { WorkflowModule } from '@libs/core/workflow/workflow.module';
import { DryRunModule } from '@libs/dryRun/dry-run.module';
import { AuthModule } from '@libs/identity/modules/auth.module';
import { UserModule } from '@libs/identity/modules/user.module';
import { PermissionsModule } from '@libs/identity/modules/permissions.module';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { IssuesModule } from '@libs/issues/issues.module';
import { KodyRulesModule } from '@libs/kodyRules/modules/kodyRules.module';
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { TeamMembersModule } from '@libs/organization/modules/teamMembers.module';
import { OrganizationParametersModule } from '@libs/organization/modules/organizationParameters.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { McpModule } from '@libs/mcp-server/mcp.module';

import { SharedMongoModule } from '@libs/shared/database/shared-mongo.module';
import { SharedPostgresModule } from '@libs/shared/database/shared-postgres.module';
import { SharedConfigModule } from '@libs/shared/infrastructure/shared-config.module';
import { SharedLogModule } from '@libs/shared/infrastructure/shared-log.module';
import { SharedObservabilityModule } from '@libs/shared/infrastructure/shared-observability.module';

import { HealthModule } from '@libs/core/health/health.module';
import { AuthController } from './controllers/auth.controller';
import { AgentController } from './controllers/agent.controller';
import { CodeReviewSettingLogController } from './controllers/codeReviewSettingLog.controller';
import { DryRunController } from './controllers/dryRun.controller';
import { IssuesController } from './controllers/issues.controller';
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
import { CodeBaseController } from './controllers/codeBase.controller';
import { CodeReviewSettingsLogModule } from '@libs/ee/codeReviewSettingsLog/codeReviewSettingsLog.module';
import { TeamController } from './controllers/team.controller';
import { TeamMembersController } from './controllers/teamMembers.controller';
import { LLMModule } from '@kodus/kodus-common/llm';
import { KodusLoggerService } from '@libs/core/log/kodus-logger.service';

/**
 * API REST Module
 *
 * This module extends AppModule (base shared infrastructure) and adds:
 * - All HTTP controllers for API REST endpoints (dashboard, admin, etc.)
 * - Platform controllers (GitHub, GitLab, Bitbucket, Azure Repos) - includes both API and webhook endpoints
 * - JWT authentication guard
 * - Rate limiting, CORS, etc. (configured in main.ts)
 * *
 * Entry point: main.ts (porta 3331)
 */
@Module({
    imports: [
        SharedConfigModule,
        SharedLogModule,
        SharedObservabilityModule,
        SharedPostgresModule.forRoot({ poolSize: 25 }),
        SharedMongoModule.forRoot(),

        LLMModule.forRoot({
            logger: KodusLoggerService,
        }),

        AuthModule,
        UserModule,
        PermissionsModule,
        KodyRulesModule,
        IssuesModule,
        OrganizationModule,
        TeamModule,
        TeamMembersModule,
        OrganizationParametersModule,
        ParametersModule,
        WorkflowModule.register({ type: 'api' }),
        PlatformModule,
        AIEngineModule,
        AgentsModule,
        CodebaseModule,
        PullRequestsModule,
        PullRequestMessagesModule,
        IntegrationModule,
        IntegrationConfigModule,
        DryRunModule,
        AnalyticsModule,
        CodeReviewSettingsLogModule,
        AutomationModule,
        McpModule.forRoot(),
        HealthModule,
    ],
    controllers: [
        // Health
        // Workflow Queue API
        WorkflowQueueController,
        // Platform Integration
        CodeManagementController,

        // Code Review
        DryRunController,
        CodeReviewSettingLogController,
        PullRequestMessagesController,
        CodeBaseController,
        IssuesController,

        // Kody Rules
        KodyRulesController,
        RuleLikeController,

        // Organization
        OrganizationController,
        ParametersController,
        TeamController,
        TeamMembersController,

        // Agent
        AgentController,
        AuthController,
        // Other
        SegmentController,
        TokenUsageController,
        PermissionsController,
    ],
})
export class ApiModule {}
