import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@libs/identity/modules/user.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { ProfilesModule } from '@libs/profiles.module';
import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
import { GetOrganizationNameUseCase } from './application/use-cases/get-organization-name';
import { UpdateInfoOrganizationAndPhoneUseCase } from './application/use-cases/update-infos.use-case';
import { GetOrganizationsByDomainUseCase } from './application/use-cases/get-organizations-domain.use-case';
import { OrganizationController } from './infrastructure/http/controllers/organization.controller';
import { ORGANIZATION_REPOSITORY_TOKEN } from './domain/organization/contracts/organization.repository.contract';
import { ORGANIZATION_SERVICE_TOKEN } from './domain/organization/contracts/organization.service.contract';
import { OrganizationDatabaseRepository } from './infrastructure/adapters/repositories/typeorm/organization.repository';
import { OrganizationModel } from './infrastructure/adapters/repositories/typeorm/schema/organization.model';
import { OrganizationService } from './infrastructure/adapters/services/organization.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationModel]),
        forwardRef(() => UsersModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => ProfilesModule),
        forwardRef(() => OrganizationParametersModule),
    ],
    providers: [
        GetOrganizationNameUseCase,
        UpdateInfoOrganizationAndPhoneUseCase,
        GetOrganizationsByDomainUseCase,
        PromptService,
        {
            provide: ORGANIZATION_SERVICE_TOKEN,
            useClass: OrganizationService,
        },
        {
            provide: ORGANIZATION_REPOSITORY_TOKEN,
            useClass: OrganizationDatabaseRepository,
        },
    ],
    controllers: [OrganizationController],
    exports: [
        ORGANIZATION_SERVICE_TOKEN,
        ORGANIZATION_REPOSITORY_TOKEN,
        OrganizationModule,
    ],
})
export class OrganizationModule {}
