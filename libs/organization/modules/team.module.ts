import { CreateOrUpdateOrganizationParametersUseCase } from '../application/use-cases/create-or-update.use-case';
import { ListTeamsUseCase } from '../application/use-cases/team/list.use-case';
import { ListTeamsWithIntegrationsUseCase } from '../application/use-cases/team/list-with-integrations.use-case';
import { TEAM_REPOSITORY_TOKEN } from '../domain/team/contracts/team.repository.contract';
import { TEAM_SERVICE_TOKEN } from '../domain/team/contracts/team.service.contract';
import { TeamEntity } from '../domain/team/entities/team.entity';
import { TeamController } from '../infrastructure/http/controllers/team.controller';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { UsersModule } from '@libs/identity/modules/user.module';
import { OrganizationParametersModule } from './org-parameters.module';
import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { ParametersModule } from './parameters.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamEntity]),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => UsersModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
    ],
    providers: [
        CreateOrUpdateOrganizationParametersUseCase,
        ListTeamsUseCase,
        ListTeamsWithIntegrationsUseCase,
        PromptService,
    ],
    exports: [TEAM_SERVICE_TOKEN, TEAM_REPOSITORY_TOKEN],
    controllers: [TeamController],
})
export class TeamsModule {}
