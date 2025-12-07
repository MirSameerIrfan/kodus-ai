import { CreateOrUpdateOrganizationParametersUseCase } from '@libs/core/application/use-cases/organizationParameters/create-or-update.use-case';
import { DeleteByokConfigUseCase } from '@libs/core/application/use-cases/organizationParameters/delete-byok-config.use-case';
import { FindByKeyOrganizationParametersUseCase } from '@libs/core/application/use-cases/organizationParameters/find-by-key.use-case';
import {
    GET_COCKPIT_METRICS_VISIBILITY_USE_CASE_TOKEN,
    GetCockpitMetricsVisibilityUseCase,
} from '@libs/core/application/use-cases/organizationParameters/get-cockpit-metrics-visibility.use-case';
import { GetModelsByProviderUseCase } from '@libs/core/application/use-cases/organizationParameters/get-models-by-provider.use-case';
import { IgnoreBotsUseCase } from '@libs/core/application/use-cases/organizationParameters/ignore-bots.use-case';
import { ORGANIZATION_PARAMETERS_REPOSITORY_TOKEN } from '@libs/core/domain/organizationParameters/contracts/organizationParameters.repository.contract';
import { ORGANIZATION_PARAMETERS_SERVICE_TOKEN } from '@libs/core/domain/organizationParameters/contracts/organizationParameters.service.contract';
import { OrganizationParametersRepository } from '@libs/core/infrastructure/adapters/repositories/typeorm/organizationParameters.repository';
import { OrganizationParametersModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/organizationParameters.model';
import { OrganizationParametersService } from '@libs/core/infrastructure/adapters/services/organizationParameters.service';
import { PlatformIntegrationFactory } from '@libs/core/infrastructure/adapters/services/platformIntegration/platformIntegration.factory';
import { PromptService } from '@libs/core/infrastructure/adapters/services/prompt.service';
import { ProviderService } from '@libs/core/infrastructure/adapters/services/providers/provider.service';
import { OrgnizationParametersController } from '@libs/core/infrastructure/http/controllers/organizationParameters.controller';
import { LicenseModule } from '@libs/ee/license/license.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { ParametersModule } from '@libs/parameters.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { TeamsModule } from '@libs/organization/modules/team.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationParametersModel]),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => PlatformIntegrationModule),
    ],
    providers: [
        CreateOrUpdateOrganizationParametersUseCase,
        FindByKeyOrganizationParametersUseCase,
        GetModelsByProviderUseCase,
        DeleteByokConfigUseCase,
        IgnoreBotsUseCase,
        {
            provide: GET_COCKPIT_METRICS_VISIBILITY_USE_CASE_TOKEN,
            useClass: GetCockpitMetricsVisibilityUseCase,
        },
        OrganizationParametersService,
        PromptService,
        PlatformIntegrationFactory,
        ProviderService,
        {
            provide: ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
            useClass: OrganizationParametersService,
        },
        {
            provide: ORGANIZATION_PARAMETERS_REPOSITORY_TOKEN,
            useClass: OrganizationParametersRepository,
        },
    ],
    controllers: [OrgnizationParametersController],
    exports: [
        ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
        ORGANIZATION_PARAMETERS_REPOSITORY_TOKEN,
        OrganizationParametersService,
        GetModelsByProviderUseCase,
        DeleteByokConfigUseCase,
        IgnoreBotsUseCase,
        GET_COCKPIT_METRICS_VISIBILITY_USE_CASE_TOKEN,
    ],
})
export class OrganizationParametersModule {}
