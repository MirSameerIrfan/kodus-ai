import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
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
import { AutomationModel } from '@libs/core/database/typeorm/schema/automation.model';
import { AutomationExecutionModel } from '@libs/core/database/typeorm/schema/automationExecution.model';
import { TeamAutomationModule } from '@libs/automation/modules/teamAutomation.module';
import { AutomationStrategyModule } from '@libs/automation/modules/automationStrategy.module';
import { LicenseModule } from '@libs/organization/ee/license/license.module';
import { CodeReviewExecutionModule } from '@libs/code-review/modules/codeReviewExecution.module';
import { PermissionValidationModule } from '@libs/common/ee/permission-validation.module';
import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { RunCodeReviewAutomationUseCase } from './ee/runCodeReview.use-case';
import { SaveCodeReviewFeedbackUseCase } from '@libs/code-review/application/use-cases/feedback/save-feedback.use-case';
import { AUTOMATION_REPOSITORY_TOKEN } from './domain/contracts/automation.repository';
import { AutomationRepository } from '@libs/core/database/typeorm/repositories/automation.repository';
import { AUTOMATION_SERVICE_TOKEN } from './domain/contracts/automation.service';
import { AutomationService } from './infrastructure/automation.service';
import { AUTOMATION_EXECUTION_SERVICE_TOKEN } from './domain/contracts/automation-execution.service';
import { AutomationExecutionService } from './infrastructure/automation-execution.service';
import { AUTOMATION_EXECUTION_REPOSITORY_TOKEN } from './domain/contracts/automation-execution.repository';
import { AutomationExecutionRepository } from '@libs/core/database/typeorm/repositories/automationExecution.repository';

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
        SaveCodeReviewFeedbackUseCase,
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
