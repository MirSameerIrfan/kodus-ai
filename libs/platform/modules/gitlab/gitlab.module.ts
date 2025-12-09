import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { RunCodeReviewAutomationUseCase } from '@libs/automation/ee/runCodeReview.use-case';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { forwardRef, Module } from '@nestjs/common';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { AutomationModule } from '@libs/automation/automation.module';
import { AutomationStrategyModule } from '@libs/automation/modules/automationStrategy.module';
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { OrganizationModule } from '@libs/organization/organization.module';
import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { TeamAutomationModule } from '@libs/automation/modules/teamAutomation.module';
import { UsersModule } from '@libs/identity/modules/user.module';
import { WebhookLogModule } from '../modules/webhookLog.module';

@Module({
    imports: [
        forwardRef(() => TeamsModule),
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => UsersModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => GlobalCacheModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => TeamAutomationModule),
        forwardRef(() => AutomationStrategyModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => WebhookLogModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [RunCodeReviewAutomationUseCase, PromptService],
    // Controllers moved to ApiModule and WebhookHandlerModule
})
export class GitlabModule {}
