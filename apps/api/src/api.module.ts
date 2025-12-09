import { Module } from '@nestjs/common';


import { PullRequestMessagesController } from './controllers/pullRequestMessages.controller';
import { PullRequestController } from './controllers/pullRequest.controller';
import { AgentController } from './controllers/agent.controller';
import { AuthController } from './controllers/auth.controller';
import { CodeBaseController } from './controllers/codeBase.controller';
import { CodeReviewSettingLogController } from './controllers/codeReviewSettingLog.controller';
import { DryRunController } from './controllers/dryRun.controller';
import { HealthController } from './controllers/health.controller';
import { IntegrationController } from './controllers/integrations/integration.controller';
import { IntegrationConfigController } from './controllers/integrations/integrationConfig.controller';
import { IssuesController } from './controllers/issues.controller';
import { KodyRulesController } from './controllers/kodyRules.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { CodeManagementController } from './controllers/platformIntegration/codeManagement.controller';
import { RuleLikeController } from './controllers/ruleLike.controller';
import { SegmentController } from './controllers/segment.controller';
import { TokenUsageController } from './controllers/tokenUsage.controller';
import { UsersController } from './controllers/user.controller';
import { WorkflowQueueController } from './controllers/workflow-queue.controller';

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
    controllers: [
        // Auth
        AuthController,
        // Health
        HealthController,
        // Workflow Queue API
        WorkflowQueueController,
        // Parameters
        // ParametersController,
        // OrganizationParametersController,
        // Organization & Teams
        // TeamController,
        // TeamMembersController,
        // Platform Integration (includes webhook endpoints for backward compatibility)
        CodeManagementController,
        IntegrationController,
        IntegrationConfigController,
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
})
export class ApiModule {}
