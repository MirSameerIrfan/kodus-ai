import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
    ],
    providers: [
        CreateOrUpdateParametersUseCase,
        UpdateOrCreateCodeReviewParameterUseCase,
        {
            provide: PARAMETERS_REPOSITORY_TOKEN,
            useClass: ParametersRepository,
        },
    ],
    exports: [
        PARAMETERS_REPOSITORY_TOKEN,
        CreateOrUpdateParametersUseCase,
        UpdateOrCreateCodeReviewParameterUseCase,
    ],
})
export class ParametersModule {}
