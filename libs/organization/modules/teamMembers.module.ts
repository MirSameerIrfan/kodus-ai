import { UseCases } from '@libs/organization/application/use-cases/team-members';
import { TEAM_MEMBERS_REPOSITORY_TOKEN } from '@libs/organization/domain/team-members/contracts/teamMembers.repository.contracts';
import { TEAM_MEMBERS_SERVICE_TOKEN } from '@libs/organization/domain/team-members/contracts/teamMembers.service.contracts';
import { TeamMembersController } from '@apps/api/controllers/teamMembers.controller';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@libs/identity/modules/user.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { MSTeamsModule } from './msTeams.module';
import { TeamMemberModel } from '@libs/organization/infrastructure/repositories/schemas/teamMember.model';
import { TeamMemberService } from '@libs/organization/infrastructure/services/teamMembers.service';
import { TeamMemberDatabaseRepository } from '@libs/organization/infrastructure/repositories/teamMember.repository';
import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { TeamsModule } from './team.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { IntegrationModule } from './integration.module';
import { DeleteUserUseCase } from '@libs/identity/application/use-cases/user/delete.use-case';
import { ParametersModule } from './parameters.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamMemberModel]),
        forwardRef(() => MSTeamsModule),
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => UsersModule),
        forwardRef(() => ParametersModule),
    ],
    providers: [
        ...UseCases,
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
