import { PromptService } from '@libs/core/infrastructure/adapters/services/prompt.service';
import { RunCodeReviewAutomationUseCase } from '@libs/ee/automation/runCodeReview.use-case';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { forwardRef, Module } from '@nestjs/common';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { AutomationModule } from '@libs/automation/automation.module';
import { AutomationStrategyModule } from '@libs/automationStrategy.module';
import { GlobalCacheModule } from '@libs/cache.module';
import { CodebaseModule } from '@libs/codeBase.module';
import { CodeReviewFeedbackModule } from '@libs/codeReviewFeedback.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { OrganizationModule } from '@libs/organization/organization.module';
import { OrganizationParametersModule } from '@libs/organizationParameters.module';
import { ParametersModule } from '@libs/parameters.module';
import { PlatformIntegrationModule } from '@libs/platformIntegration.module';
import { TeamsModule } from '@libs/team.module';
import { TeamAutomationModule } from '@libs/teamAutomation.module';
import { UsersModule } from '@libs/user.module';
import { WebhookLogModule } from '@libs/webhookLog.module';

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
