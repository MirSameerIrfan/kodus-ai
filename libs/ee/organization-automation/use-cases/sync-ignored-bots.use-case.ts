import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@kodus/flow';
import { PULL_REQUEST_MANAGER_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/PullRequestManagerService.contract';
import { PullRequestHandlerService } from '@libs/code-review/infrastructure/adapters/services/pullRequestManager.service';
import { CodeManagementService } from '@libs/platform/infrastructure/adapters/services/codeManagement.service';
import { IgnoreBotsUseCase } from '@libs/organization/application/use-cases/organizationParameters/ignore-bots.use-case';

@Injectable()
export class SyncIgnoredBotsUseCase {
    private readonly logger = createLogger(SyncIgnoredBotsUseCase.name);

    constructor(
        @Inject(PULL_REQUEST_MANAGER_SERVICE_TOKEN)
        private readonly pullRequestHandlerService: PullRequestHandlerService,
        private readonly codeManagementService: CodeManagementService,
        private readonly ignoreBotsUseCase: IgnoreBotsUseCase,
    ) {}

    public async execute(params: { organizationId: string; teamId: string }) {
        const organizationAndTeamData = {
            organizationId: params.organizationId,
            teamId: params.teamId,
        };

        const orgMembers = await this.codeManagementService.getListMembers({
            organizationAndTeamData,
            determineBots: true,
        }).catch(err => {
            this.logger.warn({ message: 'Error fetching org members', error: err });
            return [];
        });

        const prMembers = await this.pullRequestHandlerService.getPullRequestAuthorsWithCache(
            organizationAndTeamData,
            true,
        ).catch(err => {
            this.logger.warn({ message: 'Error fetching PR members', error: err });
            return [];
        });

        const users = [...orgMembers, ...prMembers];
        const botIds: string[] = Array.from(
            new Set(
                users.filter((user) => user.type === 'bot').map((b) => b.id),
            ),
        );

        return await this.ignoreBotsUseCase.execute({
            organizationId: params.organizationId,
            teamId: params.teamId,
            botIds,
        });
    }
}

