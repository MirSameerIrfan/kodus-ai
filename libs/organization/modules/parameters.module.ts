import { CreateOrUpdateParametersUseCase } from '../application/use-cases/parameters/create-or-update-use-case';
import { PARAMETERS_REPOSITORY_TOKEN } from '../domain/parameters/contracts/parameters.repository.contracts';
import { PARAMETERS_SERVICE_TOKEN } from '../domain/parameters/contracts/parameters.service.contract';
import { ParametersRepository } from '@libs/core/infrastructure/database/typeorm/repositories/parameters.repository';
import { ParametersModel } from '@libs/core/infrastructure/database/typeorm/schema/parameters.model';
import { ParametersController } from '../infrastructure/http/controllers/parameters.controller';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { CodeReviewSettingsLogModule } from '@libs/analytics/modules/settings-log.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { KodyRulesModule } from '@libs/kody-rules/kody-rules.module';
import { UpdateOrCreateCodeReviewParameterUseCase } from '../application/use-cases/parameters/update-or-create-code-review-parameter-use-case';
import { PromptsModule } from '@libs/code-review/modules/prompts.module';
import { ContextReferenceModule } from '@libs/code-review/modules/contextReference.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ParametersModel]),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => CodeReviewSettingsLogModule),
        forwardRef(() => PullRequestMessagesModule),
        forwardRef(() => KodyRulesModule),
        forwardRef(() => PromptsModule),
        forwardRef(() => ContextReferenceModule),
    ],
    providers: [
        CreateOrUpdateParametersUseCase,
        {
            provide: PARAMETERS_REPOSITORY_TOKEN,
            useClass: ParametersRepository,
        },
    ],
    controllers: [ParametersController],
    exports: [
        PARAMETERS_REPOSITORY_TOKEN,
        CreateOrUpdateParametersUseCase,
        UpdateOrCreateCodeReviewParameterUseCase,
    ],
})
export class ParametersModule {}
