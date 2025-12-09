import {
    IIntegrationService,
    INTEGRATION_SERVICE_TOKEN,
} from '@libs/integrations/domain/contracts/integration.service.contracts';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

export class GetConnectionsUseCase implements IUseCase {
    constructor(
        @Inject(INTEGRATION_SERVICE_TOKEN)
        private readonly integrationService: IIntegrationService,

        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        },
    ) {}
    public async execute(teamId: any): Promise<any[]> {
        return await this.integrationService.getConnections({
            organizationAndTeamData: {
                organizationId: this.request.user.organization.uuid,
                teamId: teamId,
            },
        });
    }
}
