import { UseCases as SaveCodeReviewFeedbackUseCase } from '@libs/core/application/use-cases/codeReviewFeedback';
import { AUTOMATION_EXECUTION_REPOSITORY_TOKEN } from '@libs/core/domain/automation/contracts/automation-execution.repository';
import { AUTOMATION_EXECUTION_SERVICE_TOKEN } from '@libs/core/domain/automation/contracts/automation-execution.service';
import { AUTOMATION_REPOSITORY_TOKEN } from '@libs/core/domain/automation/contracts/automation.repository';
import { AUTOMATION_SERVICE_TOKEN } from '@libs/core/domain/automation/contracts/automation.service';
import { AutomationRepository } from '@libs/core/infrastructure/adapters/repositories/typeorm/automation.repository';
import { AutomationExecutionRepository } from '@libs/core/infrastructure/adapters/repositories/typeorm/automationExecution.repository';
import { AutomationModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/automation.model';
import { AutomationExecutionModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/automationExecution.model';
import { AutomationExecutionService } from '@libs/core/infrastructure/adapters/services/automation/automation-execution.service';
import { AutomationService } from '@libs/core/infrastructure/adapters/services/automation/automation.service';
import { PromptService } from '@libs/core/infrastructure/adapters/services/prompt.service';
import { RunCodeReviewAutomationUseCase } from '@libs/ee/automation/runCodeReview.use-case';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { AutomationStrategyModule } from '@libs/automation/modules/strategy.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { CodeReviewExecutionModule } from '@libs/code-review/modules/execution.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';
import { GithubModule } from '@libs/platform/modules/github.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { OrganizationModule } from '@libs/organization/organization.module';
import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { TeamAutomationModule } from '@libs/organization/modules/team-automation.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([AutomationModel, AutomationExecutionModel]),
        forwardRef(() => TeamsModule),
        forwardRef(() => GithubModule),
        forwardRef(() => TeamAutomationModule),
        forwardRef(() => AutomationStrategyModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => PullRequestsModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => CodeReviewExecutionModule),
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [
        ...SaveCodeReviewFeedbackUseCase,
        PromptService,
        RunCodeReviewAutomationUseCase,
        {
            provide: AUTOMATION_REPOSITORY_TOKEN,
            useClass: AutomationRepository,
        },
        {
            provide: AUTOMATION_SERVICE_TOKEN,
            useClass: AutomationService,
        },
        {
            provide: AUTOMATION_EXECUTION_SERVICE_TOKEN,
            useClass: AutomationExecutionService,
        },
        {
            provide: AUTOMATION_EXECUTION_REPOSITORY_TOKEN,
            useClass: AutomationExecutionRepository,
        },
    ],
    controllers: [],
    exports: [
        AUTOMATION_REPOSITORY_TOKEN,
        AUTOMATION_SERVICE_TOKEN,
        AUTOMATION_EXECUTION_SERVICE_TOKEN,
        AUTOMATION_EXECUTION_REPOSITORY_TOKEN,
        RunCodeReviewAutomationUseCase,
    ],
})
export class AutomationModule {}
