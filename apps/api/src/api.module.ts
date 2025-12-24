import { Module } from '@nestjs/common';
import { HealthModule } from '@libs/core/health/health.module';
import { SharedCoreModule } from '@libs/shared/infrastructure/shared-core.module';
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
import { WorkflowModule } from '@libs/core/workflow/modules/workflow.module';
import { CodeReviewConfigurationModule } from '@libs/code-review/modules/code-review-configuration.module';
import { OrganizationOnboardingModule } from '@libs/organization/modules/organization-onboarding.module';
import { CodeReviewDashboardModule } from '@libs/code-review/modules/code-review-dashboard.module';

import { CronModule } from './cron/cron.module';
import { OrganizationParametersController } from './controllers/organizationParameters.controller';
import { AgentController } from './controllers/agent.controller';
import { AuthController } from './controllers/auth.controller';
import { CodeBaseController } from './controllers/codeBase.controller';
import { CodeManagementController } from './controllers/codeManagement.controller';
import { CodeReviewSettingLogController } from './controllers/codeReviewSettingLog.controller';
import { DryRunController } from './controllers/dryRun.controller';
import { IntegrationController } from './controllers/integration.controller';
import { IntegrationConfigController } from './controllers/integrationConfig.controller';
import { IssuesController } from './controllers/issues.controller';
import { KodyRulesController } from './controllers/kodyRules.controller';
import { OrganizationController } from './controllers/organization.controller';
import { ParametersController } from './controllers/parameters.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { PullRequestController } from './controllers/pullRequest.controller';
import { PullRequestMessagesController } from './controllers/pullRequestMessages.controller';
import { RuleLikeController } from './controllers/ruleLike.controller';
import { SegmentController } from './controllers/segment.controller';
import { TeamController } from './controllers/team.controller';
import { TeamMembersController } from './controllers/teamMembers.controller';
import { TokenUsageController } from './controllers/tokenUsage.controller';
import { UsersController } from './controllers/user.controller';
import { LoggerWrapperService } from '@libs/core/log/loggerWrapper.service';

@Module({
    imports: [
        SharedCoreModule,
        SharedConfigModule,
        SharedLogModule,
        SharedObservabilityModule,
        SharedPostgresModule.forRoot({ poolSize: 25 }),
        SharedMongoModule.forRoot(),
        LLMModule.forRoot({
            logger: LoggerWrapperService,
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
        CodeReviewConfigurationModule,
        OrganizationOnboardingModule,
        CodeReviewDashboardModule,
        McpModule.forRoot(),
        HealthModule,
        CronModule,
    ],
    controllers: [
        // WorkflowQueueController,
        CodeManagementController,
        DryRunController,
        CodeReviewSettingLogController,
        PullRequestMessagesController,
        CodeBaseController,
        IssuesController,
        KodyRulesController,
        RuleLikeController,
        OrganizationController,
        ParametersController,
        OrganizationParametersController,
        TeamController,
        TeamMembersController,
        AgentController,
        AuthController,
        SegmentController,
        TokenUsageController,
        PermissionsController,
        IntegrationController,
        IntegrationConfigController,
        PullRequestController,
        UsersController,
    ],
})
export class ApiModule {}
