import { Module, forwardRef } from '@nestjs/common';
import { FindByKeyParametersUseCase } from '../application/use-cases/parameters/find-by-key-use-case';
import { GetDefaultConfigUseCase } from '../application/use-cases/parameters/get-default-config.use-case';
import { OrganizationParametersModule } from './organizationParameters.module';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermissionsModule } from '@libs/identity/modules/permissions.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { CreateOrUpdateParametersUseCase } from '../application/use-cases/parameters/create-or-update-use-case';
import { PARAMETERS_REPOSITORY_TOKEN } from '../domain/parameters/contracts/parameters.repository.contracts';
import { ParametersModel } from '../infrastructure/adapters/repositories/schemas/parameters.model';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { ParametersRepository } from '../infrastructure/adapters/repositories/parameters.repository';
import { PARAMETERS_SERVICE_TOKEN } from '../domain/parameters/contracts/parameters.service.contract';
import { ParametersService } from '../infrastructure/adapters/services/parameters.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([ParametersModel]),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => OrganizationParametersModule),
        PermissionsModule,
    ],
    providers: [
        CreateOrUpdateParametersUseCase,
        FindByKeyParametersUseCase,
        GetDefaultConfigUseCase,
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
        FindByKeyParametersUseCase,
        GetDefaultConfigUseCase,
    ],
})
export class ParametersModule {}
