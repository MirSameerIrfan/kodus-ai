import { Module, forwardRef } from '@nestjs/common';
import { ApplyCodeReviewPresetUseCase } from '../application/use-cases/parameters/apply-code-review-preset.use-case';
import { DeleteRepositoryCodeReviewParameterUseCase } from '../application/use-cases/parameters/delete-repository-code-review-parameter.use-case';
import { FindByKeyParametersUseCase } from '../application/use-cases/parameters/find-by-key-use-case';
import { GenerateKodusConfigFileUseCase } from '../application/use-cases/parameters/generate-kodus-config-file.use-case';
import { GetCodeReviewParameterUseCase } from '../application/use-cases/parameters/get-code-review-parameter.use-case';
import { GetDefaultConfigUseCase } from '../application/use-cases/parameters/get-default-config.use-case';
import { ListCodeReviewAutomationLabelsUseCase } from '../application/use-cases/parameters/list-code-review-automation-labels-use-case';
import { ListCodeReviewAutomationLabelsWithStatusUseCase } from '../application/use-cases/parameters/list-code-review-automation-labels-with-status.use-case';
import { PreviewPrSummaryUseCase } from '../application/use-cases/parameters/preview-pr-summary.use-case';
import { UpdateCodeReviewParameterRepositoriesUseCase } from '../application/use-cases/parameters/update-code-review-parameter-repositories-use-case';
import { OrganizationParametersModule } from './organizationParameters.module';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermissionsModule } from '@libs/identity/modules/permissions.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { ContextReferenceModule } from '@libs/code-review/modules/contextReference.module';
import { PromptsModule } from '@libs/code-review/modules/prompts.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { CreateOrUpdateParametersUseCase } from '../application/use-cases/parameters/create-or-update-use-case';
import { PARAMETERS_REPOSITORY_TOKEN } from '../domain/parameters/contracts/parameters.repository.contracts';
import { UpdateOrCreateCodeReviewParameterUseCase } from '../application/use-cases/parameters/update-or-create-code-review-parameter-use-case';
import { ParametersModel } from '../infrastructure/adapters/repositories/schemas/parameters.model';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { CodeReviewSettingsLogModule } from '@libs/ee/codeReviewSettingsLog/codeReviewSettingsLog.module';
import { ParametersRepository } from '../infrastructure/adapters/repositories/parameters.repository';
import { KodyRulesModule } from '@libs/kodyRules/modules/kodyRules.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { PARAMETERS_SERVICE_TOKEN } from '../domain/parameters/contracts/parameters.service.contract';
import { ParametersService } from '../infrastructure/adapters/services/parameters.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([ParametersModel]),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => CodeReviewSettingsLogModule),
        forwardRef(() => PullRequestMessagesModule),
        forwardRef(() => KodyRulesModule),
        forwardRef(() => PromptsModule),
        forwardRef(() => ContextReferenceModule),
        forwardRef(() => OrganizationParametersModule),
        PermissionsModule,
    ],
    providers: [
        CreateOrUpdateParametersUseCase,
        UpdateOrCreateCodeReviewParameterUseCase,
        ApplyCodeReviewPresetUseCase,
        DeleteRepositoryCodeReviewParameterUseCase,
        FindByKeyParametersUseCase,
        GenerateKodusConfigFileUseCase,
        GetCodeReviewParameterUseCase,
        GetDefaultConfigUseCase,
        ListCodeReviewAutomationLabelsUseCase,
        ListCodeReviewAutomationLabelsWithStatusUseCase,
        PreviewPrSummaryUseCase,
        UpdateCodeReviewParameterRepositoriesUseCase,
        {
            provide: PARAMETERS_REPOSITORY_TOKEN,
            useClass: ParametersRepository,
        },
        {
            provide: PARAMETERS_SERVICE_TOKEN,
            useClass: ParametersService,
        },
    ],
    exports: [
        PARAMETERS_REPOSITORY_TOKEN,
        PARAMETERS_SERVICE_TOKEN,
        CreateOrUpdateParametersUseCase,
        UpdateOrCreateCodeReviewParameterUseCase,
        ApplyCodeReviewPresetUseCase,
        DeleteRepositoryCodeReviewParameterUseCase,
        FindByKeyParametersUseCase,
        GenerateKodusConfigFileUseCase,
        GetCodeReviewParameterUseCase,
        GetDefaultConfigUseCase,
        ListCodeReviewAutomationLabelsWithStatusUseCase,
        PreviewPrSummaryUseCase,
        UpdateCodeReviewParameterRepositoriesUseCase,
    ],
})
export class ParametersModule {}
