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

export class CreateOrUpdateTeamMembersUseCase implements IUseCase {
    private readonly logger = createLogger(CreateOrUpdateTeamMembersUseCase.name);
    constructor(
        @Inject(TEAM_MEMBERS_SERVICE_TOKEN)
        private readonly teamMembersService: ITeamMemberService,
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        }
    ) {}
    public async execute(teamId: string, members: IMembers[]): Promise<any> {
        try {
            return this.teamMembersService.updateOrCreateMembers(members, {
                organizationId: this.request.user.organization.uuid,
                teamId,
            });
        } catch (error) {
            this.logger.error({
                message: 'Error while creating team members',
                context: CreateOrUpdateTeamMembersUseCase.name,
                serviceName: 'GetOrganizationMetricsByIdUseCase',
                error: error,
                metadata: {
                    organizationId: this.request.user.organization.uuid,
                },
            });
        }
    }
}
