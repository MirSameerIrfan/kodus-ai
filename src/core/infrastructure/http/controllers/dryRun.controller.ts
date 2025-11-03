import { UserRequest } from '@/config/types/http/user-request.type';
import { ExecuteDryRunUseCase } from '@/core/application/use-cases/dryRun/execute-dry-run.use-case';
import { Body, Controller, Inject, Post } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

@Controller('dry-run')
export class DryRunController {
    constructor(
        private readonly executeDryRunUseCase: ExecuteDryRunUseCase,

        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    @Post('execute')
    execute(
        @Body()
        body: any,
    ) {
        if (!this.request.user?.organization?.uuid) {
            throw new Error('Organization UUID is missing in the request');
        }

        return this.executeDryRunUseCase.execute({
            organizationAndTeamData: {
                organizationId: this.request.user.organization.uuid,
                teamId: body.teamId,
            },
            repository: body.repository,
            prNumber: body.prNumber,
            platformType: body.platformType,
        });
    }
}
