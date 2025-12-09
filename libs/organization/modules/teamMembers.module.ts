import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { DeleteUserUseCase } from '@libs/identity/application/use-cases/user/delete.use-case';
import { UsersModule } from '@libs/identity/modules/user.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';

import { ParametersModule } from './parameters.module';
import { TeamsModule } from './team.module';
import { CreateOrUpdateTeamMembersUseCase } from '../application/use-cases/team-members/create.use-case';
import { GetTeamMembersUseCase } from '../application/use-cases/team-members/get-team-members.use-case';
import { DeleteTeamMembersUseCase } from '../application/use-cases/team-members/delete.use-case';
import { TEAM_MEMBERS_REPOSITORY_TOKEN } from '../domain/team-members/contracts/teamMembers.repository.contracts';
import { TEAM_MEMBERS_SERVICE_TOKEN } from '../domain/team-members/contracts/teamMembers.service.contracts';
import { TeamMembersController } from '../infrastructure/http/controllers/teamMembers.controller';


import { TeamMemberModel } from '../infrastructure/adapters/repositories/schemas/teamMember.model';
import { TeamMemberService } from '../infrastructure/adapters/services/teamMembers.service';
import { TeamMemberDatabaseRepository } from '../infrastructure/adapters/repositories/teamMember.repository';



@Module({
    imports: [
        TypeOrmModule.forFeature([TeamMemberModel]),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => UsersModule),
        forwardRef(() => ParametersModule),
    ],
    providers: [
        CreateOrUpdateTeamMembersUseCase,
        GetTeamMembersUseCase,
        DeleteTeamMembersUseCase,
        DeleteUserUseCase,
        PromptService,
        {
            provide: TEAM_MEMBERS_SERVICE_TOKEN,
            useClass: TeamMemberService,
        },
        {
            provide: TEAM_MEMBERS_REPOSITORY_TOKEN,
            useClass: TeamMemberDatabaseRepository,
        },
    ],
    exports: [TEAM_MEMBERS_SERVICE_TOKEN, TEAM_MEMBERS_REPOSITORY_TOKEN],
    controllers: [TeamMembersController],
})
export class TeamMembersModule {}
