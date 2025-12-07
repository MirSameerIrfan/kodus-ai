import { UseCases } from '@libs/core/application/use-cases/github';
import { GITHUB_SERVICE_TOKEN } from '@libs/core/domain/github/contracts/github.service.contract';
import { GithubService } from '@libs/core/infrastructure/adapters/services/github/github.service';
import { PromptService } from '@libs/core/infrastructure/adapters/services/prompt.service';
import { RunCodeReviewAutomationUseCase } from '@libs/ee/automation/runCodeReview.use-case';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { OrganizationModule } from '@libs/organization.module';
import { TeamsModule } from '@libs/team.module';
import { UsersModule } from '@libs/user.module';
import { Module, forwardRef } from '@nestjs/common';
import { AgentModule } from '@libs/agent.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { AutomationModule } from '@libs/automation/automation.module';
import { AutomationStrategyModule } from '@libs/automationStrategy.module';
import { GlobalCacheModule } from '@libs/cache.module';
import { CodebaseModule } from '@libs/codeBase.module';
import { CodeReviewFeedbackModule } from '@libs/codeReviewFeedback.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { OrganizationParametersModule } from '@libs/organizationParameters.module';
import { ParametersModule } from '@libs/parameters.module';
import { PlatformIntegrationModule } from '@libs/platformIntegration.module';
import { TeamAutomationModule } from '@libs/teamAutomation.module';
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
        forwardRef(() => AgentModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => WebhookLogModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [
        ...UseCases,
        RunCodeReviewAutomationUseCase,
        PromptService,
        {
            provide: GITHUB_SERVICE_TOKEN,
            useClass: GithubService,
        },
    ],
    exports: [GITHUB_SERVICE_TOKEN],
    // Controllers moved to ApiModule and WebhookHandlerModule
})
export class GithubModule {}
