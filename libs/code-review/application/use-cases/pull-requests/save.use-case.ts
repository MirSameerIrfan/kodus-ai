import { createLogger } from '@kodus/flow';
import { OrganizationAndTeamData } from '@libs/core/domain/types/general/organizationAndTeamData';
import {
    IIntegrationConfigService,
    INTEGRATION_CONFIG_SERVICE_TOKEN,
} from '@libs/integrations/domain/configs/contracts/integration-config.service.contracts';
import { stripCurlyBracesFromUUIDs } from '@libs/platform/domain/platformIntegrations/types/webhooks/webhooks-bitbucket.type';
import {
    IPullRequestsService,
    PULL_REQUESTS_SERVICE_TOKEN,
} from '@libs/code-review/domain/pull-requests/contracts/pullRequests.service.contracts';
import { IPullRequests } from '@libs/code-review/domain/pull-requests/interfaces/pullRequests.interface';
import { CodeManagementService } from '@libs/platform/infrastructure/services/codeManagement.service';
import { IntegrationConfigKey } from '@libs/core/domain/enums/Integration-config-key.enum';
import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { getMappedPlatform } from '@libs/core/utils/webhooks';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SavePullRequestUseCase {
    private readonly logger = createLogger(SavePullRequestUseCase.name);
    constructor(
        @Inject(INTEGRATION_CONFIG_SERVICE_TOKEN)
        private readonly integrationConfigService: IIntegrationConfigService,
        @Inject(PULL_REQUESTS_SERVICE_TOKEN)
        private readonly pullRequestsService: IPullRequestsService,
        private readonly codeManagement: CodeManagementService,
    ) {}

    public async execute(params: {
        payload: any;
        platformType: PlatformType;
        event: string;
    }): Promise<IPullRequests | null> {
        const { payload, platformType, event } = params;

        if (this.isValidPullRequestAction({ payload, platformType })) {
            const sanitizedPayload =
                platformType === PlatformType.BITBUCKET
                    ? stripCurlyBracesFromUUIDs(payload)
                    : payload;

            const mappedPlatform = getMappedPlatform(platformType);
            if (!mappedPlatform) {
                return;
            }

            const pullRequest = mappedPlatform.mapPullRequest({
                payload: sanitizedPayload,
            });
            if (
                !pullRequest &&
                !pullRequest?.number &&
                !pullRequest?.repository &&
                !pullRequest?.user
            ) {
                return;
            }

            const repository = mappedPlatform.mapRepository({
                payload: sanitizedPayload,
            });
            if (!repository && !repository?.id && !repository?.name) {
                return;
            }

            let organizationAndTeamData: OrganizationAndTeamData | null = null;

            try {
                const configs =
                    await this.integrationConfigService.findIntegrationConfigWithTeams(
                        IntegrationConfigKey.REPOSITORIES,
                        repository.id,
                        platformType,
                    );

                if (!configs || !configs.length) {
                    this.logger.warn({
                        message: `No repository configuration found for repository ${repository?.name}`,
                        context: SavePullRequestUseCase.name,
                        metadata: {
                            repositoryName: repository?.name,
                            pullRequestNumber: pullRequest?.number,
                        },
                    });

                    return null;
                }

                const organizationAndTeamDataList: OrganizationAndTeamData[] =
                    configs.map((config) => ({
                        organizationId: config.team.organization.uuid,
                        teamId: config.team.uuid,
                    }));

                organizationAndTeamData =
                    organizationAndTeamDataList[0] ?? null;

                const changedFiles =
                    await this.codeManagement.getFilesByPullRequestId(
                        {
                            organizationAndTeamData,
                            prNumber: pullRequest?.number,
                            repository,
                        },
                        platformType,
                    );

                const relevantUsers = mappedPlatform.mapUsers({
                    payload: sanitizedPayload,
                });

                const pullRequestWithUserData: any = {
                    ...pullRequest,
                    ...relevantUsers,
                };

                const pullRequestCommits =
                    await this.codeManagement.getCommitsForPullRequestForCodeReview(
                        {
                            organizationAndTeamData,
                            repository: {
                                id: repository.id,
                                name: repository.name,
                            },
                            prNumber: pullRequestWithUserData.number,
                        },
                    );

                try {
                    const result =
                        await this.pullRequestsService.aggregateAndSaveDataStructure(
                            pullRequestWithUserData,
                            repository,
                            changedFiles,
                            [],
                            [],
                            platformType,
                            organizationAndTeamData,
                            pullRequestCommits,
                        );

                    return result;
                } catch (error) {
                    this.logger.error({
                        message: `Failed to aggregate and save pull request data for PR#${pullRequestWithUserData?.number}`,
                        context: SavePullRequestUseCase.name,
                        error,
                        metadata: {
                            repository: repository?.name,
                            pullRequest: pullRequestWithUserData?.number,
                            organizationAndTeamData,
                            platformType,
                            event,
                        },
                    });
                    return null;
                }
            } catch (error) {
                this.logger.error({
                    message: `Failed to save pull request data for PR#${pullRequest?.number}`,
                    context: SavePullRequestUseCase.name,
                    error,
                    metadata: {
                        repository: repository?.name,
                        pullRequest: pullRequest?.number,
                        organizationAndTeamData,
                        platformType,
                        event,
                    },
                });
            }
        }
    }

    private isValidPullRequestAction(params: {
        payload: any;
        platformType: PlatformType;
    }): boolean {
        const { payload, platformType } = params;

        const validActions = [
            'opened',
            'closed',
            'synchronize',
            'review_requested',
            'review_request_removed',
            'assigned',
            'unassigned',
            'active',
            'completed',
            'ready_for_review',
        ] as const;
        const validObjectActions = [
            'open',
            'close',
            'merge',
            'update',
        ] as const;

        // bitbucket was already validated by the webhook type
        return (
            validActions.includes(payload?.action) ||
            validObjectActions.includes(payload?.object_attributes?.action) ||
            validActions.includes(payload?.resource?.status) ||
            validActions.includes(payload?.resource?.pullRequest?.status) ||
            platformType === PlatformType.BITBUCKET
        );
    }
}
