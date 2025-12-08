import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@libs/identity/infrastructure/auth/jwt-auth.guard';
import { AppModule } from './app.module';
import { AuthController } from '@apps/api/controllers/auth.controller';
import { HealthController } from '@apps/api/controllers/health.controller';
import { WorkflowQueueController } from '@apps/api/controllers/workflow-queue.controller';
import { ParametersController } from '@apps/api/controllers/parameters.controller';
import { OrganizationController } from '@apps/api/controllers/organization.controller';
import { OrgnizationParametersController } from '@apps/api/controllers/organizationParameters.controller';
import { TeamController } from '@apps/api/controllers/team.controller';
import { CodeManagementController } from '@apps/api/controllers/platformIntegration/codeManagement.controller';
import { IntegrationController } from '@apps/api/controllers/integrations/integration.controller';
import { IntegrationConfigController } from '@apps/api/controllers/integrations/integrationConfig.controller';
import { KodyRulesController } from '@apps/api/controllers/kodyRules.controller';
import { DryRunController } from '@apps/api/controllers/dryRun.controller';
import { CodeBaseController } from '@apps/api/controllers/codeBase.controller';
import { AgentController } from '@apps/api/controllers/agent.controller';
import { SegmentController } from '@apps/api/controllers/segment.controller';
import { UsersController } from '@apps/api/controllers/user.controller';
import { TeamMembersController } from '@apps/api/controllers/teamMembers.controller';
import { RuleLikeController } from '@apps/api/controllers/ruleLike.controller';
import { PullRequestMessagesController } from '@apps/api/controllers/pullRequestMessages.controller';
import { PullRequestController } from '@apps/api/controllers/pullRequest.controller';
import { IssuesController } from '@apps/api/controllers/issues.controller';
import { CodeReviewSettingLogController } from '@apps/api/controllers/codeReviewSettingLog.controller';
import { TokenUsageController } from '@apps/api/controllers/tokenUsage.controller';
import { PermissionsController } from '@apps/api/controllers/permissions.controller';
import { GithubController } from '@apps/api/controllers/github.controller';
import { GitlabController } from '@apps/api/controllers/gitlab.controller';
import { BitbucketController } from '@apps/api/controllers/bitbucket.controller';
import { AzureReposController } from '@apps/api/controllers/azureRepos.controller';

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
    imports: [AppModule],
    controllers: [
        // Auth
        AuthController,
        // Health
        HealthController,
        // Workflow Queue API
        WorkflowQueueController,
        // Parameters
        ParametersController,
        OrgnizationParametersController,
        // Organization & Teams
        OrganizationController,
        TeamController,
        TeamMembersController,
        // Platform Integration (includes webhook endpoints for backward compatibility)
        CodeManagementController,
        IntegrationController,
        IntegrationConfigController,
        GithubController, // Includes GET endpoints + POST /webhook
        GitlabController, // Includes POST /webhook
        BitbucketController, // Includes POST /webhook
        AzureReposController, // Includes POST /webhook
        // Code Review
        KodyRulesController,
        DryRunController,
        CodeBaseController,
        CodeReviewSettingLogController,
        PullRequestController,
        PullRequestMessagesController,
        // Agent
        AgentController,
        // Other
        SegmentController,
        UsersController,
        RuleLikeController,
        IssuesController,
        TokenUsageController,
        PermissionsController,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
    ],
})
export class ApiModule {}
