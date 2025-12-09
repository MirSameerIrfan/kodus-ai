import { Inject, Injectable } from '@nestjs/common';

import { TeamAutomationsDto } from '@libs/automation/infrastructure/http/dtos/team-automation.dto';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import {
    IProfileConfigService,
    PROFILE_CONFIG_SERVICE_TOKEN,
} from '@libs/identity/domain/profile-configs/contracts/profileConfig.service.contract';
import { ProfileConfigKey } from '@libs/identity/domain/profile-configs/enum/profileConfigKey.enum';
import {
    ITeamAutomationService,
    TEAM_AUTOMATION_SERVICE_TOKEN,
} from '@libs/automation/domain/teamAutomation/contracts/team-automation.service';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import {
    EXECUTE_AUTOMATION_SERVICE_TOKEN,
    IExecuteAutomationService,
} from '@libs/automation/domain/automationExecution/contracts/execute.automation.service.contracts';

@Injectable()
export class UpdateOrCreateTeamAutomationUseCase implements IUseCase {
    constructor(
        @Inject(TEAM_AUTOMATION_SERVICE_TOKEN)
        private readonly teamAutomationService: ITeamAutomationService,

        @Inject(EXECUTE_AUTOMATION_SERVICE_TOKEN)
        private readonly executeAutomation: IExecuteAutomationService,

        @Inject(PROFILE_CONFIG_SERVICE_TOKEN)
        private readonly profileConfigService: IProfileConfigService,

        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        },
    ) {}

    async execute(teamAutomations: TeamAutomationsDto) {
        const organizationAndTeamData = this.getOrganizationAndTeamData(
            teamAutomations.teamId,
        );

        const oldTeamAutomation = await this.teamAutomationService.find({
            team: { uuid: teamAutomations.teamId },
        });

        if (!oldTeamAutomation) {
            this.setupNewAutomations(
                teamAutomations.automations,
                organizationAndTeamData,
            );
        } else {
            this.updateOrCreateAutomations(
                teamAutomations,
                oldTeamAutomation,
                organizationAndTeamData,
            );
        }

        return await this.addProfileConfigServiceToTeamMembers();
    }

    private getOrganizationAndTeamData(teamId: string) {
        return {
            organizationId: this.request.user?.organization?.uuid,
            teamId,
        };
    }

    private setupNewAutomations(
        automations: TeamAutomationsDto['automations'],
        organizationAndTeamData: any,
    ) {
        for (const automation of automations) {
            this.executeAutomation.setupStrategy(
                automation?.automationType,
                organizationAndTeamData,
            );
        }
    }

    private updateOrCreateAutomations(
        teamAutomations: TeamAutomationsDto,
        oldTeamAutomation: any[],
        organizationAndTeamData: any,
    ) {
        for (const automation of teamAutomations.automations) {
            const existingAutomation = oldTeamAutomation.find(
                (old) => old.automation.uuid === automation.automationUuid,
            );

            if (existingAutomation) {
                this.teamAutomationService.update(
                    { uuid: existingAutomation.uuid },
                    {
                        uuid: existingAutomation.uuid,
                        status: existingAutomation.status,
                        team: { uuid: teamAutomations.teamId },
                        automation: { uuid: automation.automationUuid },
                    },
                );
            } else if (automation.status) {
                this.executeAutomation.setupStrategy(
                    automation.automationType,
                    organizationAndTeamData,
                );
            }
        }
    }

    private async addProfileConfigServiceToTeamMembers() {
        const profileConfigService = await this.profileConfigService.findOne({
            configKey: ProfileConfigKey.USER_NOTIFICATIONS,
        });

        if (!profileConfigService) {
            return 'Team members not found';
        }

        return {
            id: profileConfigService.configValue.communicationId,
            name: profileConfigService.configValue.name,
        };
    }
}
