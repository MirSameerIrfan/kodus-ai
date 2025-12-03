import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@/core/infrastructure/adapters/services/auth/jwt-auth.guard';
import { AppModule } from './app.module';
import { AuthController } from '@/core/infrastructure/http/controllers/auth.controller';
import { HealthController } from '@/core/infrastructure/http/controllers/health.controller';
import { WorkflowQueueController } from '@/core/infrastructure/http/controllers/workflow-queue.controller';
import { ParametersController } from '@/core/infrastructure/http/controllers/parameters.controller';
import { OrganizationController } from '@/core/infrastructure/http/controllers/organization.controller';
import { OrgnizationParametersController } from '@/core/infrastructure/http/controllers/organizationParameters.controller';
import { TeamController } from '@/core/infrastructure/http/controllers/team.controller';
import { CodeManagementController } from '@/core/infrastructure/http/controllers/platformIntegration/codeManagement.controller';
import { IntegrationController } from '@/core/infrastructure/http/controllers/integrations/integration.controller';
import { IntegrationConfigController } from '@/core/infrastructure/http/controllers/integrations/integrationConfig.controller';
import { KodyRulesController } from '@/core/infrastructure/http/controllers/kodyRules.controller';
import { DryRunController } from '@/core/infrastructure/http/controllers/dryRun.controller';
import { CodeBaseController } from '@/core/infrastructure/http/controllers/codeBase.controller';
import { AgentController } from '@/core/infrastructure/http/controllers/agent.controller';
import { SegmentController } from '@/core/infrastructure/http/controllers/segment.controller';
import { UsersController } from '@/core/infrastructure/http/controllers/user.controller';
import { TeamMembersController } from '@/core/infrastructure/http/controllers/teamMembers.controller';
import { RuleLikeController } from '@/core/infrastructure/http/controllers/ruleLike.controller';
import { PullRequestMessagesController } from '@/core/infrastructure/http/controllers/pullRequestMessages.controller';
import { PullRequestController } from '@/core/infrastructure/http/controllers/pullRequest.controller';
import { IssuesController } from '@/core/infrastructure/http/controllers/issues.controller';
import { CodeReviewSettingLogController } from '@/core/infrastructure/http/controllers/codeReviewSettingLog.controller';
import { TokenUsageController } from '@/core/infrastructure/http/controllers/tokenUsage.controller';
import { PermissionsController } from '@/core/infrastructure/http/controllers/permissions.controller';
import { GithubController } from '@/core/infrastructure/http/controllers/github.controller';
import { GitlabController } from '@/core/infrastructure/http/controllers/gitlab.controller';
import { BitbucketController } from '@/core/infrastructure/http/controllers/bitbucket.controller';
import { AzureReposController } from '@/core/infrastructure/http/controllers/azureRepos.controller';

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
