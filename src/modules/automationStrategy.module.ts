import { UseCases as SaveCodeReviewFeedbackUseCase } from '@/core/application/use-cases/codeReviewFeedback';
import { ExecuteAutomationService } from '@/core/infrastructure/adapters/services/automation/processAutomation/config/execute.automation';
import { AutomationRegistry } from '@/core/infrastructure/adapters/services/automation/processAutomation/config/register.automation';
import { AutomationCodeReviewService } from '@/core/infrastructure/adapters/services/automation/processAutomation/strategies/automationCodeReview';
import { PromptService } from '@/core/infrastructure/adapters/services/prompt.service';
import { LicenseModule } from '@/ee/license/license.module';
import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';
import { TeamsModule } from '@/modules/team.module';
import { EXECUTE_AUTOMATION_SERVICE_TOKEN } from '@/shared/domain/contracts/execute.automation.service.contracts';
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
import { OrganizationAutomationModule } from './organizationAutomation.module';
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
        forwardRef(() => OrganizationAutomationModule),
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
        AuthIntegrationModule,
        LicenseModule,
        PermissionValidationModule,
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
