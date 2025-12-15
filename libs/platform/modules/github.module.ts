import { Module, forwardRef } from '@nestjs/common';

import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { LicenseModule } from '@libs/ee/license/license.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { PlatformModule } from './platform.module';
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { UserModule } from '@libs/identity/modules/user.module';
import { GitHubPullRequestHandler } from '../infrastructure/webhooks/github/githubPullRequest.handler';
import { GithubService as GitHubService } from '../infrastructure/adapters/services/github/github.service';
import { IssuesModule } from '@libs/issues/issues.module';
import { PlatformDataModule } from '@libs/platformData/platformData.module';
import { WorkflowModule } from '@libs/core/workflow/workflow.module';
import { KodyRulesModule } from '@libs/kodyRules/modules/kodyRules.module';

@Module({
    imports: [
        forwardRef(() => TeamModule),
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => UserModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => GlobalCacheModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => PermissionValidationModule),
        forwardRef(() => IssuesModule),
        forwardRef(() => PlatformDataModule),
        forwardRef(() => WorkflowModule),
        forwardRef(() => KodyRulesModule),
    ],
    providers: [
        GitHubService,
        GitHubPullRequestHandler,
        {
            provide: 'GITHUB_WEBHOOK_HANDLER',
            useClass: GitHubPullRequestHandler,
        },
    ],
    exports: [
        GitHubService,
        GitHubPullRequestHandler,
        'GITHUB_WEBHOOK_HANDLER',
    ],
})
export class GithubModule {}
