import { Controller, Get } from '@nestjs/common';

import { ListTeamsWithIntegrationsUseCase } from '@libs/organization/application/use-cases/team/list-with-integrations.use-case';
import { ListTeamsUseCase } from '@libs/organization/application/use-cases/team/list.use-case';

@Controller('team')
export class TeamController {
    constructor(
        private readonly listTeamsUseCase: ListTeamsUseCase,
        private readonly listTeamsWithIntegrationsUseCase: ListTeamsWithIntegrationsUseCase,
    ) {}

    @Get('/')
    public async list() {
        return await this.listTeamsUseCase.execute();
    }

    @Get('/list-with-integrations')
    public async listWithIntegrations() {
        return await this.listTeamsWithIntegrationsUseCase.execute();
    }
}
