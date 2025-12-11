import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { AutomationStrategyModule } from '@libs/automation/modules/automationStrategy.module';
import { TeamAutomationModule } from '@libs/automation/modules/teamAutomation.module';
import { SaveCodeReviewFeedbackUseCase } from '@libs/code-review/application/use-cases/codeReviewFeedback/save-feedback.use-case';
import { CodebaseCoreModule } from '@libs/code-review/modules/codebase-core.module';
import { CodeReviewExecutionModule } from '@libs/code-review/modules/codeReviewExecution.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';
import { PullRequestsCoreModule } from '@libs/code-review/modules/pull-requests-core.module';
import { AutomationModel } from '@libs/core/infrastructure/database/typeorm/schema/automation.model';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { AuthIntegrationModule } from '@libs/integrations/modules/authIntegration.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { OrganizationCoreModule } from '@libs/organization/modules/organization-core.module';
import { GithubModule } from '@libs/platform/modules/github.module';
// import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
import { ParametersCoreModule } from '@libs/organization/modules/parameters-core.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { TeamCoreModule } from '@libs/organization/modules/team-core.module';
import { AutomationExecutionModel } from '@libs/core/infrastructure/database/typeorm/schema/automationExecution.model';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';

import { AUTOMATION_EXECUTION_REPOSITORY_TOKEN } from './domain/contracts/automation-execution.repository';
import { AUTOMATION_EXECUTION_SERVICE_TOKEN } from './domain/contracts/automation-execution.service';
import { AUTOMATION_REPOSITORY_TOKEN } from './domain/contracts/automation.repository';
import { AUTOMATION_SERVICE_TOKEN } from './domain/contracts/automation.service';
import { RunCodeReviewAutomationUseCase } from './ee/runCodeReview.use-case';

import { AutomationRepository } from '@libs/core/infrastructure/database/typeorm/repositories/automation.repository';

import { AutomationExecutionService } from './infrastructure/automation-execution.service';
import { AutomationService } from './infrastructure/automation.service';

import { AutomationExecutionRepository } from '@libs/core/infrastructure/database/typeorm/repositories/automationExecution.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([AutomationModel, AutomationExecutionModel]),
        forwardRef(() => TeamCoreModule),
        forwardRef(() => GithubModule),
        forwardRef(() => TeamAutomationModule),
        forwardRef(() => AutomationStrategyModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => OrganizationCoreModule),
        forwardRef(() => AuthIntegrationModule),
        forwardRef(() => ParametersCoreModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => CodebaseCoreModule),
        forwardRef(() => PullRequestsCoreModule),
        // forwardRef(() => OrganizationParametersModule),
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
