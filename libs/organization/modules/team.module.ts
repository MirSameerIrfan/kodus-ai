import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { UserModule } from '@libs/identity/modules/user.module';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';

import { ListTeamsWithIntegrationsUseCase } from '../application/use-cases/team/list-with-integrations.use-case';
import { ListTeamsUseCase } from '../application/use-cases/team/list.use-case';
import { TEAM_REPOSITORY_TOKEN } from '../domain/team/contracts/team.repository.contract';
import { TEAM_SERVICE_TOKEN } from '../domain/team/contracts/team.service.contract';
import { TeamEntity } from '../domain/team/entities/team.entity';
import { CreateOrUpdateOrganizationParametersUseCase } from '../application/use-cases/organizationParameters/create-or-update.use-case';
import { ParametersModule } from './parameters.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamEntity]),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => UserModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
    ],
    providers: [
        CreateOrUpdateOrganizationParametersUseCase,
        ListTeamsUseCase,
        ListTeamsWithIntegrationsUseCase,
    ],
    exports: [
        TEAM_SERVICE_TOKEN,
        TEAM_REPOSITORY_TOKEN,
        CreateOrUpdateOrganizationParametersUseCase,
    ],
})
export class TeamModule {}
