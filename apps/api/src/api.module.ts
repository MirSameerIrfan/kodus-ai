import { Module } from '@nestjs/common';
import { HealthModule } from '@libs/core/health/health.module';
import { SharedConfigModule } from '@libs/shared/infrastructure/shared-config.module';
import { SharedLogModule } from '@libs/shared/infrastructure/shared-log.module';
import { SharedObservabilityModule } from '@libs/shared/infrastructure/shared-observability.module';
import { SharedPostgresModule } from '@libs/shared/database/shared-postgres.module';
import { SharedMongoModule } from '@libs/shared/database/shared-mongo.module';
import { AuthModule } from '@libs/identity/modules/auth.module';
import { UserModule } from '@libs/identity/modules/user.module';
import { PermissionsModule } from '@libs/identity/modules/permissions.module';
import { KodyRulesModule } from '@libs/kodyRules/modules/kodyRules.module';
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { TeamMembersModule } from '@libs/organization/modules/teamMembers.module';
import { OrganizationParametersModule } from '@libs/organization/modules/organizationParameters.module';
import { AgentsModule } from '@libs/agents/modules/agents.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { McpModule } from '@libs/mcp-server/mcp.module';
import { LLMModule } from '@kodus/kodus-common/llm';
import { KodusLoggerService } from '@libs/core/log/kodus-logger.service';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { AIEngineModule } from '@libs/ai-engine/modules/ai-engine.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { IssuesModule } from '@libs/issues/issues.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { CodeReviewSettingsLogModule } from '@libs/ee/codeReviewSettingsLog/codeReviewSettingsLog.module';
import { DryRunModule } from '@libs/dryRun/dry-run.module';
import { AnalyticsModule } from '@libs/analytics/modules/analytics.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { WorkflowModule } from '@libs/core/workflow/workflow.module';

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
        // WorkflowQueueController,
        // CodeManagementController,
        // DryRunController,
        // CodeReviewSettingLogController,
        // PullRequestMessagesController,
        // CodeBaseController,
        // IssuesController,
        // KodyRulesController,
        // RuleLikeController,
        // OrganizationController,
        // ParametersController,
        // TeamController,
        // TeamMembersController,
        // AgentController,
        // AuthController,
        // SegmentController,
        // TokenUsageController,
        // PermissionsController,
    ],
})
export class ApiModule {}
