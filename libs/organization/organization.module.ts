import { UseCases } from '@libs/core/application/use-cases/organization';
import { ORGANIZATION_REPOSITORY_TOKEN } from '@libs/core/domain/organization/contracts/organization.repository.contract';
import { ORGANIZATION_SERVICE_TOKEN } from '@libs/core/domain/organization/contracts/organization.service.contract';
import { OrganizationDatabaseRepository } from '@libs/core/infrastructure/adapters/repositories/typeorm/organization.repository';
import { OrganizationModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/organization.model';
import { OrganizationService } from '@libs/core/infrastructure/adapters/services/organization.service';
import { OrganizationController } from '@libs/core/infrastructure/http/controllers/organization.controller';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@libs/identity/modules/user.module';
import { TeamsModule } from '@libs/organization/modules/team.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { PromptService } from '@libs/core/infrastructure/adapters/services/prompt.service';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { ProfilesModule } from '@libs/profiles.module';
import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';

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
        ...UseCases,
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
