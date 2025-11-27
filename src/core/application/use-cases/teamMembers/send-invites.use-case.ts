import { createLogger } from "@kodus/flow";
import { Inject } from '@nestjs/common';
import { IUseCase } from '@/shared/domain/interfaces/use-case.interface';
import { IMembers } from '@/core/domain/teamMembers/interfaces/team-members.interface';
import {
    ITeamMemberService,
    TEAM_MEMBERS_SERVICE_TOKEN,
} from '@/core/domain/teamMembers/contracts/teamMembers.service.contracts';
import { Request } from 'express';
import { REQUEST } from '@nestjs/core';
import {
    IUsersService,
    USER_SERVICE_TOKEN,
} from '@/core/domain/user/contracts/user.service.contract';
import { IUser } from '@/core/domain/user/interfaces/user.interface';

export class SendInvitesUseCase implements IUseCase {
    private readonly logger = createLogger(SendInvitesUseCase.name);
    constructor(
        @Inject(TEAM_MEMBERS_SERVICE_TOKEN)
        private readonly teamMembersService: ITeamMemberService,
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        }
    ) {}
    public async execute(
        teamId: string,
        organizationId: string,
        members: IUser[],
    ): Promise<any> {
        try {
            await this.teamMembersService.sendInvitations(members, {
                organizationId: organizationId,
                teamId: teamId,
            });
        } catch (error) {
            this.logger.error({
                message: 'Error while creating team users',
                context: SendInvitesUseCase.name,
                serviceName: 'GetOrganizationMetricsByIdUseCase',
                error: error,
                metadata: {
                    organizationId: organizationId,
                },
            });
        }
    }
}
