import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { ProfileConfigModule } from '@libs/identity/modules/profileConfig.module';
import { UserCoreModule } from '@libs/identity/modules/user-core.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';

// import { OrganizationParametersModule } from './org-parameters.module'; // MISSING
import { ParametersCoreModule } from './parameters-core.module';
import { CreateOrUpdateOrganizationParametersUseCase } from '../application/use-cases/create-or-update.use-case';
import { ListTeamsWithIntegrationsUseCase } from '../application/use-cases/team/list-with-integrations.use-case';
import { ListTeamsUseCase } from '../application/use-cases/team/list.use-case';
import { TEAM_REPOSITORY_TOKEN } from '../domain/team/contracts/team.repository.contract';
import { TEAM_SERVICE_TOKEN } from '../domain/team/contracts/team.service.contract';
import { TeamEntity } from '../domain/team/entities/team.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamEntity]),
        forwardRef(() => ProfileConfigModule),
        forwardRef(() => UserCoreModule),
        // forwardRef(() => OrganizationParametersModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersCoreModule),
    ],
    providers: [
        CreateOrUpdateOrganizationParametersUseCase,
        ListTeamsUseCase,
        ListTeamsWithIntegrationsUseCase,
        PromptService,
    ],
    exports: [TEAM_SERVICE_TOKEN, TEAM_REPOSITORY_TOKEN],
})
export class TeamCoreModule {}
