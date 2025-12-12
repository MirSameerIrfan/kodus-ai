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
import { AzureReposService } from '../infrastructure/adapters/services/azureRepos/azureRepos.service';
import { AzureReposPullRequestHandler } from '../infrastructure/webhooks/azure/azureReposPullRequest.handler';
import { IssuesModule } from '@libs/issues/issues.module';
import { UserModule } from '@libs/identity/modules/user.module';

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
    ],
    providers: [AzureReposService, AzureReposPullRequestHandler],
    exports: [AzureReposService, AzureReposPullRequestHandler],
})
export class AzureReposModule {}
