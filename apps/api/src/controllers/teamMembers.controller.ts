import { CreateOrUpdateTeamMembersUseCase } from '@libs/organization/application/use-cases/team-members/create.use-case';
import { DeleteTeamMembersUseCase } from '@libs/organization/application/use-cases/team-members/delete.use-case';
import { GetTeamMembersUseCase } from '@libs/organization/application/use-cases/team-members/get-team-members.use-case';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { IMembers } from '@libs/organization/domain/team-members/interfaces/team-members.interface';
import {
    Body,
    Controller,
    DefaultValuePipe,
    Delete,
    Get,
    Param,
    ParseBoolPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/permissions/policy.guard';
import { checkPermissions } from '@libs/identity/infrastructure/permissions/policy.handlers';
import { TeamQueryDto } from '../dtos/teamId-query-dto';

@Controller('team-members')
export class TeamMembersController {
    constructor(
        private readonly createOrUpdateTeamMembersUseCase: CreateOrUpdateTeamMembersUseCase,
        private readonly getTeamMembersUseCase: GetTeamMembersUseCase,
        private readonly deleteTeamMembersUseCase: DeleteTeamMembersUseCase,
    ) {}

    @Get('/')
    @UseGuards(PolicyGuard)
    @CheckPolicies(checkPermissions(Action.Read, ResourceType.UserSettings))
    public async getTeamMembers(@Query() query: TeamQueryDto) {
        return this.getTeamMembersUseCase.execute(query.teamId);
    }

    @Post('/')
    @UseGuards(PolicyGuard)
    @CheckPolicies(checkPermissions(Action.Create, ResourceType.UserSettings))
    public async createOrUpdateTeamMembers(
        @Body() body: { members: IMembers[]; teamId: string },
    ) {
        return this.createOrUpdateTeamMembersUseCase.execute(
            body.teamId,
            body.members,
        );
    }

    @Delete('/:uuid')
    @UseGuards(PolicyGuard)
    @CheckPolicies(checkPermissions(Action.Delete, ResourceType.UserSettings))
    public async deleteTeamMember(
        @Param('uuid') uuid: string,
        @Query('removeAll', new DefaultValuePipe(false), ParseBoolPipe)
        removeAll: boolean,
    ) {
        return this.deleteTeamMembersUseCase.execute(uuid, removeAll);
    }
}
