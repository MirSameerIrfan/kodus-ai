import { UseCases as SaveCodeReviewFeedbackUseCase } from '@libs/code-review/application/use-cases/feedback';
import { ExecuteAutomationService } from '@libs/automation/infrastructure/process/config/execute.automation';
import { AutomationRegistry } from '@libs/automation/infrastructure/process/config/register.automation';
import { AutomationCodeReviewService } from '@libs/automation/infrastructure/process/strategies/automationCodeReview';
import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { EXECUTE_AUTOMATION_SERVICE_TOKEN } from '@libs/core/domain/contracts/execute.automation.service.contracts';
import { Module, forwardRef } from '@nestjs/common';
import { AuthIntegrationModule } from './authIntegration.module';
import { AutomationModule } from './automation.module';
import { CodebaseModule } from './codeBase.module';
import { CodeReviewExecutionModule } from './codeReviewExecution.module';
import { CodeReviewFeedbackModule } from './codeReviewFeedback.module';
import { GithubModule } from './github.module';
import { IntegrationModule } from './integration.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { OrganizationModule } from './organization.module';
import { OrganizationParametersModule } from './organizationParameters.module';
import { ParametersModule } from './parameters.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { ProfileConfigModule } from './profileConfig.module';
import { PullRequestsModule } from './pullRequests.module';
import { TeamAutomationModule } from './teamAutomation.module';
import { TeamMembersModule } from './teamMembers.module';

@Module({
    imports: [
        forwardRef(() => GithubModule),
        forwardRef(() => TeamAutomationModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => TeamMembersModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => PullRequestsModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => CodeReviewExecutionModule),
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [
        ...SaveCodeReviewFeedbackUseCase,
        AutomationCodeReviewService,
        PromptService,
        {
            provide: EXECUTE_AUTOMATION_SERVICE_TOKEN,
            useClass: ExecuteAutomationService,
        },
        {
            provide: 'STRATEGIES_AUTOMATION',
            useFactory: (
                automationCodeReviewService: AutomationCodeReviewService,
            ) => {
                return [automationCodeReviewService];
            },
            inject: [AutomationCodeReviewService],
        },
        AutomationRegistry,
    ],
    exports: [
        'STRATEGIES_AUTOMATION',
        EXECUTE_AUTOMATION_SERVICE_TOKEN,
        AutomationRegistry,
    ],
})
export class AutomationStrategyModule {}
