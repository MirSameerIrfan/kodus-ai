import { CreateTeamUseCase } from '../application/use-cases/create.use-case';
import { DeleteTeamUseCase } from '../application/use-cases/delete.use-case';
import { ListTeamsUseCase } from '../application/use-cases/list.use-case';
import { ListTeamsWithIntegrationsUseCase } from '../application/use-cases/list-with-integrations.use-case';
import { TEAM_REPOSITORY_TOKEN } from '../domain/team/contracts/team.repository.contract';
import { TEAM_SERVICE_TOKEN } from '../domain/team/contracts/team.service.contract';
import { TeamModel } from '../infrastructure/adapters/repositories/typeorm/schema/team.model';
import { TeamDatabaseRepository } from '../infrastructure/adapters/repositories/typeorm/team.repository';
import { TeamService } from '../infrastructure/adapters/services/team.service';
import { TeamController } from '../infrastructure/http/controllers/team.controller';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { UsersModule } from '@libs/identity/modules/user.module';
import { OrganizationParametersModule } from './org-parameters.module';
import { OrganizationParametersService } from '../infrastructure/adapters/services/organizationParameters.service';
import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { CreateOrUpdateParametersUseCase } from '../application/use-cases/create-or-update-use-case';
import { ParametersModule } from './parameters.module';

import { PlatformIntegrationFactory } from '../infrastructure/adapters/services/platformIntegration/platformIntegration.factory';
import { IntegrationModel } from '@libs/integrations/domain/entities/integration.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamModel]),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => UsersModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
    ],
    providers: [
        CreateTeamUseCase,
        DeleteTeamUseCase,
        ListTeamsUseCase,
        ListTeamsWithIntegrationsUseCase,
        CreateOrUpdateParametersUseCase,
        OrganizationParametersService,
        PlatformIntegrationFactory,
        PromptService,
        TeamService,
        {
            provide: TEAM_SERVICE_TOKEN,
            useClass: TeamService,
        },
        {
            provide: TEAM_REPOSITORY_TOKEN,
            useClass: TeamDatabaseRepository,
        },
    ],
    exports: [TEAM_SERVICE_TOKEN, TEAM_REPOSITORY_TOKEN, CreateTeamUseCase],
    controllers: [TeamController],
})
export class TeamsModule {}
