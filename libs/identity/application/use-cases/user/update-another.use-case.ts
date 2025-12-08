import { createLogger } from '@kodus/flow';
import {
    ORGANIZATION_SERVICE_TOKEN,
    IOrganizationService,
} from '@libs/organization/domain/organization/contracts/organization.service.contract';
import {
    TEAM_SERVICE_TOKEN,
    ITeamService,
} from '@libs/organization/domain/team/contracts/team.service.contract';
import {
    TEAM_MEMBERS_SERVICE_TOKEN,
    ITeamMemberService,
} from '@libs/organization/domain/team-members/contracts/teamMembers.service.contracts';
import {
    USER_SERVICE_TOKEN,
    IUsersService,
} from '@libs/identity/domain/user/contracts/user.service.contract';
import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';
import { IUseCase } from '@libs/common/domain/interfaces/use-case.interface';
import { Inject, Injectable } from '@nestjs/common';
import { UpdateAnotherUserDto } from 'apps/api/src/dtos/update-another-user.dto';

@Injectable()
export class UpdateAnotherUserUseCase implements IUseCase {
    private readonly logger = createLogger(UpdateAnotherUserUseCase.name);
    constructor(
        @Inject(USER_SERVICE_TOKEN)
        private readonly usersService: IUsersService,
        @Inject(ORGANIZATION_SERVICE_TOKEN)
        private readonly organizationService: IOrganizationService,
        @Inject(TEAM_SERVICE_TOKEN)
        private readonly teamService: ITeamService,
        @Inject(TEAM_MEMBERS_SERVICE_TOKEN)
        private readonly teamMembersService: ITeamMemberService,
    ) {}

    async execute(
        userId: string,
        targetUserId: string,
        data: UpdateAnotherUserDto,
    ): Promise<IUser> {
        const { role, status } = data;

        try {
            const targetUser = await this.usersService.findOne({
                uuid: targetUserId,
            });
            if (!targetUser) {
                throw new Error('Target user not found');
            }

            const organization = await this.organizationService.findOne({
                uuid: targetUser.organization?.uuid,
            });
            if (!organization) {
                throw new Error('Organization not found');
            }

            const team = await this.teamService.findOne({
                organization: {
                    uuid: organization.uuid,
                },
            });
            if (!team) {
                throw new Error('Team not found');
            }

            const teamMember = await this.teamMembersService.findOne({
                organization: {
                    uuid: organization.uuid,
                },
                user: {
                    uuid: targetUser.uuid,
                },
            });
            if (!teamMember) {
                throw new Error(
                    'Target user is not a member of the organization team',
                );
            }

            const updatedUser = await this.usersService.update(
                { uuid: targetUserId },
                {
                    status,
                    role,
                },
            );

            if (!updatedUser) {
                throw new Error('Error updating user');
            }

            this.logger.log({
                message: 'User updated another user',
                context: UpdateAnotherUserUseCase.name,
                metadata: { userId, targetUserId, data },
            });

            return updatedUser.toObject();
        } catch (error) {
            this.logger.error({
                message: 'Error updating another user',
                error,
                metadata: { userId, targetUserId, data },
                context: UpdateAnotherUserUseCase.name,
            });
            throw error;
        }
    }
}
