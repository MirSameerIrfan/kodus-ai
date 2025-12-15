import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { UserModule } from '@libs/identity/modules/user.module';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';

import { CreateTeamUseCase } from '../application/use-cases/team/create.use-case';
import { ListTeamsWithIntegrationsUseCase } from '../application/use-cases/team/list-with-integrations.use-case';
import { ListTeamsUseCase } from '../application/use-cases/team/list.use-case';
import { TEAM_REPOSITORY_TOKEN } from '../domain/team/contracts/team.repository.contract';
import { TEAM_SERVICE_TOKEN } from '../domain/team/contracts/team.service.contract';
import { TeamModel } from '../infrastructure/adapters/repositories/schemas/team.model';
import { IntegrationModel } from '@libs/integrations/infrastructure/adapters/repositories/schemas/integration.model';
import { OrganizationParametersModule } from './organizationParameters.module';
import { ParametersModule } from './parameters.module';

import { TeamService } from '../infrastructure/adapters/services/team.service';
import { TeamDatabaseRepository } from '../infrastructure/adapters/repositories/team.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamModel, IntegrationModel]),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => UserModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => OrganizationParametersModule),
    ],
    providers: [
        CreateTeamUseCase,
        ListTeamsUseCase,
        ListTeamsWithIntegrationsUseCase,
        {
            provide: TEAM_SERVICE_TOKEN,
            useClass: TeamService,
        },
        {
            provide: TEAM_REPOSITORY_TOKEN,
            useClass: TeamDatabaseRepository,
        },
    ],
    exports: [
        TEAM_SERVICE_TOKEN,
        TEAM_REPOSITORY_TOKEN,
        CreateTeamUseCase,
        ListTeamsUseCase,
        ListTeamsWithIntegrationsUseCase,
    ],
})
export class TeamModule {}
