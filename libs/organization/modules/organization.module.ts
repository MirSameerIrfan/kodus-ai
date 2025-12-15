import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfilesModule } from '@libs/identity/modules/profiles.module';
import { UserModule } from '@libs/identity/modules/user.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';

import { OrganizationService } from '../infrastructure/adapters/services/organization.service';
import { OrganizationModel } from '../infrastructure/adapters/repositories/schemas/organization.model';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { ORGANIZATION_SERVICE_TOKEN } from '../domain/organization/contracts/organization.service.contract';
import { ORGANIZATION_REPOSITORY_TOKEN } from '../domain/organization/contracts/organization.repository.contract';
import { OrganizationDatabaseRepository } from '../infrastructure/adapters/repositories/organization.repository';
import { GetOrganizationsByDomainUseCase } from '../application/use-cases/organization/get-organizations-domain.use-case';
import { UpdateInfoOrganizationAndPhoneUseCase } from '../application/use-cases/organization/update-infos.use-case';
import { GetOrganizationNameUseCase } from '../application/use-cases/organization/get-organization-name';
import { TeamModule } from './team.module';
import { OrganizationParametersModule } from './organizationParameters.module';
import { ParametersModule } from './parameters.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationModel]),
        forwardRef(() => UserModule),
        forwardRef(() => ProfilesModule),
        forwardRef(() => TeamModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => OrganizationParametersModule),
    ],
    providers: [
        GetOrganizationNameUseCase,
        UpdateInfoOrganizationAndPhoneUseCase,
        GetOrganizationsByDomainUseCase,
        {
            provide: ORGANIZATION_SERVICE_TOKEN,
            useClass: OrganizationService,
        },
        {
            provide: ORGANIZATION_REPOSITORY_TOKEN,
            useClass: OrganizationDatabaseRepository,
        },
    ],
    exports: [
        ORGANIZATION_SERVICE_TOKEN,
        ORGANIZATION_REPOSITORY_TOKEN,
        GetOrganizationNameUseCase,
        UpdateInfoOrganizationAndPhoneUseCase,
        GetOrganizationsByDomainUseCase,
    ],
})
export class OrganizationModule {}
