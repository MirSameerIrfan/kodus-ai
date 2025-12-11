import { Module, forwardRef } from '@nestjs/common';

import { AutomationStrategyModule } from '@libs/automation/modules/automationStrategy.module';
import { TeamAutomationModule } from '@libs/automation/modules/teamAutomation.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { LicenseModule } from '@libs/ee/license/license.module';
import { UserCoreModule } from '@libs/identity/modules/user-core.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { ParametersCoreModule } from '@libs/organization/modules/parameters-core.module';
import { TeamCoreModule } from '@libs/organization/modules/team-core.module';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { PlatformModule } from './platform.module';
import { OrganizationCoreModule } from '@libs/organization/modules/organization-core.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';

@Module({
    imports: [
        forwardRef(() => TeamCoreModule),
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => OrganizationCoreModule),
        forwardRef(() => UserCoreModule),
        forwardRef(() => ParametersCoreModule),
        forwardRef(() => GlobalCacheModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => TeamAutomationModule),
        forwardRef(() => AutomationStrategyModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => PermissionValidationModule),
    ],
})
export class GithubModule {}
