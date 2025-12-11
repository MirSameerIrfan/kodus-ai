import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeleteUserUseCase } from '@libs/identity/application/use-cases/user/delete.use-case';
import { UserCoreModule } from '@libs/identity/modules/user-core.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { TeamMemberModel } from '../infrastructure/adapters/repositories/schemas/teamMember.model';
import { TeamMemberService } from '../infrastructure/adapters/services/teamMembers.service';
import { TeamMemberDatabaseRepository } from '../infrastructure/adapters/repositories/teamMember.repository';

import { ParametersCoreModule } from './parameters-core.module';
import { TeamCoreModule } from './team-core.module';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { CreateOrUpdateTeamMembersUseCase } from '../application/use-cases/teamMembers/create.use-case';
import { GetTeamMembersUseCase } from '../application/use-cases/teamMembers/get-team-members.use-case';
import { DeleteTeamMembersUseCase } from '../application/use-cases/teamMembers/delete.use-case';
import { TEAM_MEMBERS_SERVICE_TOKEN } from '../domain/teamMembers/contracts/teamMembers.service.contracts';
import { TEAM_MEMBERS_REPOSITORY_TOKEN } from '../domain/teamMembers/contracts/teamMembers.repository.contracts';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamMemberModel]),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => TeamCoreModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => UserCoreModule),
        forwardRef(() => ParametersCoreModule),
    ],
    providers: [
        CreateOrUpdateTeamMembersUseCase,
        GetTeamMembersUseCase,
        DeleteTeamMembersUseCase,
        DeleteUserUseCase,
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
})
export class TeamMembersCoreModule {}
