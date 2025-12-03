import { AZURE_REPOS_SERVICE_TOKEN } from '@/core/domain/azureRepos/contracts/azure-repos.service.contract';
import { AzureReposService } from '@/core/infrastructure/adapters/services/azureRepos.service';
import { AzureReposRequestHelper } from '@/core/infrastructure/adapters/services/azureRepos/azure-repos-request-helper';
import { PromptService } from '@/core/infrastructure/adapters/services/prompt.service';
import { RunCodeReviewAutomationUseCase } from '@/ee/automation/runCodeReview.use-case';
import { LicenseModule } from '@/ee/license/license.module';
import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';
import { OrganizationModule } from '@/modules/organization.module';
import { TeamsModule } from '@/modules/team.module';
import { UsersModule } from '@/modules/user.module';
import { Module, forwardRef } from '@nestjs/common';
import { AgentModule } from './agent.module';
import { AuthIntegrationModule } from './authIntegration.module';
import { AutomationModule } from './automation.module';
import { AutomationStrategyModule } from './automationStrategy.module';
import { GlobalCacheModule } from './cache.module';
import { CodebaseModule } from './codeBase.module';
import { CodeReviewFeedbackModule } from './codeReviewFeedback.module';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { OrganizationParametersModule } from './organizationParameters.module';
import { ParametersModule } from './parameters.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { TeamAutomationModule } from './teamAutomation.module';
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
        forwardRef(() => AgentModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => WebhookLogModule),
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [
        RunCodeReviewAutomationUseCase,
        PromptService,
        AzureReposRequestHelper,
        {
            provide: AZURE_REPOS_SERVICE_TOKEN,
            useClass: AzureReposService,
        },
    ],
    exports: [AZURE_REPOS_SERVICE_TOKEN],
    // Controllers moved to ApiModule and WebhookHandlerModule
    // AzureReposController is registered in ApiModule and WebhookHandlerModule
})
export class AzureReposModule {}
