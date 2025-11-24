import { PromptService } from '@/core/infrastructure/adapters/services/prompt.service';
import { GitlabController } from '@/core/infrastructure/http/controllers/gitlab.controller';
import { RunCodeReviewAutomationUseCase } from '@/ee/automation/runCodeReview.use-case';
import { LicenseModule } from '@/ee/license/license.module';
import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';
import { forwardRef, Module } from '@nestjs/common';
import { AuthIntegrationModule } from './authIntegration.module';
import { AutomationModule } from './automation.module';
import { AutomationStrategyModule } from './automationStrategy.module';
import { GlobalCacheModule } from './cache.module';
import { CodebaseModule } from './codeBase.module';
import { CodeReviewFeedbackModule } from './codeReviewFeedback.module';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { OrganizationModule } from './organization.module';
import { OrganizationParametersModule } from './organizationParameters.module';
import { ParametersModule } from './parameters.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { TeamsModule } from './team.module';
import { TeamAutomationModule } from './teamAutomation.module';
import { UsersModule } from './user.module';
import { WebhookLogModule } from './webhookLog.module';

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
    controllers: [GitlabController],
})
export class GitlabModule {}
