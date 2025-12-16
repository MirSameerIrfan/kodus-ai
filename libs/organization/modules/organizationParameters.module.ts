import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrganizationParametersService } from '../infrastructure/adapters/services/organizationParameters.service';
import { OrganizationParametersModel } from '../infrastructure/adapters/repositories/schemas/organizationParameters.model';
import { ORGANIZATION_PARAMETERS_SERVICE_TOKEN } from '../domain/organizationParameters/contracts/organizationParameters.service.contract';
import { ORGANIZATION_PARAMETERS_REPOSITORY_TOKEN } from '../domain/organizationParameters/contracts/organizationParameters.repository.contract';
import { OrganizationParametersRepository } from '../infrastructure/adapters/repositories/organizationParameters.repository';
import { CreateOrUpdateOrganizationParametersUseCase } from '../application/use-cases/organizationParameters/create-or-update.use-case';
import { FindByKeyOrganizationParametersUseCase } from '../application/use-cases/organizationParameters/find-by-key.use-case';
import { DeleteByokConfigUseCase } from '../application/use-cases/organizationParameters/delete-byok-config.use-case';
import { IgnoreBotsUseCase } from '../application/use-cases/organizationParameters/ignore-bots.use-case';

@Module({
    imports: [TypeOrmModule.forFeature([OrganizationParametersModel])],
    providers: [
        {
            provide: ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
            useClass: OrganizationParametersService,
        },
        {
            provide: ORGANIZATION_PARAMETERS_REPOSITORY_TOKEN,
            useClass: OrganizationParametersRepository,
        },
        CreateOrUpdateOrganizationParametersUseCase,
        FindByKeyOrganizationParametersUseCase,
        DeleteByokConfigUseCase,
        IgnoreBotsUseCase,
    ],
    exports: [
        ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
        ORGANIZATION_PARAMETERS_REPOSITORY_TOKEN,
        CreateOrUpdateOrganizationParametersUseCase,
        FindByKeyOrganizationParametersUseCase,
        DeleteByokConfigUseCase,
        IgnoreBotsUseCase,
    ],
})
export class OrganizationParametersModule {}
