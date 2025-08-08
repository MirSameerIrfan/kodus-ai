import { Injectable } from '@nestjs/common';
import {
    IWebhookEventHandler,
    IWebhookEventParams,
} from '@/core/domain/platformIntegrations/interfaces/webhook-event-handler.interface';
import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { SavePullRequestUseCase } from '@/core/application/use-cases/pullRequests/save.use-case';
import { RunCodeReviewAutomationUseCase } from '@/ee/automation/runCodeReview.use-case';
import { ChatWithKodyFromGitUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/chatWithKodyFromGit.use-case';
import { CodeManagementService } from '@/core/infrastructure/adapters/services/platformIntegration/codeManagement.service';
import { getMappedPlatform } from '@/shared/utils/webhooks';
import { GenerateIssuesFromPrClosedUseCase } from '@/core/application/use-cases/issues/generate-issues-from-pr-closed.use-case';
import { PullRequest } from '@/core/domain/platformIntegrations/types/codeManagement/pullRequests.type';
import { IMappedPullRequest } from '@/core/domain/platformIntegrations/types/webhooks/webhooks-common.type';

/**
 * Handler for GitHub webhook events.
 * Processes both pull request and comment events.
 */
@Injectable()
export class GitHubPullRequestHandler implements IWebhookEventHandler {
    constructor(
        private readonly logger: PinoLoggerService,
        private readonly savePullRequestUseCase: SavePullRequestUseCase,
        private readonly runCodeReviewAutomationUseCase: RunCodeReviewAutomationUseCase,
        private readonly chatWithKodyFromGitUseCase: ChatWithKodyFromGitUseCase,
        private readonly codeManagement: CodeManagementService,
        private readonly generateIssuesFromPrClosedUseCase: GenerateIssuesFromPrClosedUseCase,
    ) {}

    public canHandle(params: IWebhookEventParams): boolean {
        // Verify if the event is from GitHub
        if (params.platformType !== PlatformType.GITHUB) {
            return false;
        }

        // Verify if the event is one of the supported events
        const supportedEvents = [
            'pull_request',
            'issue_comment',
            'pull_request_review_comment',
        ];
        if (!supportedEvents.includes(params.event)) {
            return false;
        }

        // Verify if the event is a pull_request and check the action type
        if (params.event === 'pull_request') {
            // These actions are allowed to be processed by this handler
            const allowedActions = [
                'opened',
                'synchronize',
                'closed',
                'reopened',
            ];

            // If the action is in the allowed list, we can process it
            return allowedActions.includes(params.payload?.action);
        }

        // If all checks pass, return true
        return true;
    }

    public async execute(params: IWebhookEventParams): Promise<void> {
        const { event } = params;

        switch (event) {
            case 'pull_request':
                await this.handlePullRequest(params);
                break;
            case 'issue_comment':
            case 'pull_request_review_comment':
                await this.handleComment(params);
                break;
            default:
                this.logger.warn({
                    message: `Unsupported GitHub event: ${event}`,
                    context: GitHubPullRequestHandler.name,
                });
                return;
        }
    }

    /**
     * Process pull request events from GitHub
     */
    private async handlePullRequest(
        params: IWebhookEventParams,
    ): Promise<void> {
        const { payload } = params;

        const prNumber = payload?.pull_request?.number || payload?.number;
        const prUrl = payload?.pull_request?.html_url;

        this.logger.log({
            context: GitHubPullRequestHandler.name,
            serviceName: GitHubPullRequestHandler.name,
            metadata: {
                prNumber,
                prUrl,
            },
            message: `Processing GitHub 'pull_request' event for PR #${prNumber} (${prUrl || 'URL not found'})`,
        });

        try {
            // Save the PR state
            await this.savePullRequestUseCase.execute(params);

            // Execute code review automation if necessary
            this.runCodeReviewAutomationUseCase.execute(params);

            if (payload?.action === 'closed') {
                await this.generateIssuesFromPrClosedUseCase.execute(params);
            }
            return;
        } catch (error) {
            this.logger.error({
                context: GitHubPullRequestHandler.name,
                serviceName: GitHubPullRequestHandler.name,
                metadata: {
                    prNumber,
                    prUrl,
                },
                message: `Error processing GitHub pull request #${prNumber}: ${error.message}`,
                error,
            });
            throw error;
        }
    }

    /**
     * Process comment events from GitHub
     */
    private async handleComment(params: IWebhookEventParams): Promise<void> {
        const { payload, event } = params;
        const prNumber = payload?.object_attributes?.iid;

        try {
            // Extract comment data
            const mappedPlatform = getMappedPlatform(PlatformType.GITHUB);

            if (!mappedPlatform) {
                this.logger.error({
                    message: 'Could not get mapped platform for GitHub.',
                    serviceName: GitHubPullRequestHandler.name,
                    metadata: {
                        prNumber,
                    },
                    context: GitHubPullRequestHandler.name,
                });
                return;
            }

            const comment = mappedPlatform.mapComment({ payload });

            if (!comment || !comment.body || payload?.action === 'deleted') {
                this.logger.debug({
                    message:
                        'Comment body empty or action is deleted, skipping.',
                    serviceName: GitHubPullRequestHandler.name,
                    metadata: {
                        prNumber,
                    },
                    context: GitHubPullRequestHandler.name,
                });
                return;
            }

            // Verify if it is a start-review command
            const commandPattern = /^\s*@kody\s+start-review/i;
            const isStartCommand = commandPattern.test(comment.body);

            // Verify if it has the review marker
            const reviewMarkerPattern = /<!--\s*kody-codereview\s*-->/i;
            const hasReviewMarker = reviewMarkerPattern.test(comment.body);

            const pullRequest = mappedPlatform.mapPullRequest({ payload });

            // Verify if the comment mentions Kody and is not a start-review command
            const kodyMentionPattern = /^\s*@kody\b(?!\s+start-review)/i;

            // If it is a start-review command and does not have the review marker
            if (isStartCommand && !hasReviewMarker) {
                this.logger.log({
                    message: `@kody start command detected in GitHub comment for PR#${pullRequest?.number}`,
                    serviceName: GitHubPullRequestHandler.name,
                    metadata: {
                        prNumber,
                    },
                    context: GitHubPullRequestHandler.name,
                });

                // Logic to fetch PR details for GitHub issue_comment
                let pullRequestData = null;
                if (
                    !payload?.pull_request &&
                    payload?.issue &&
                    payload?.issue?.number
                ) {
                    const repository = {
                        id: payload.repository.id,
                        name: payload.repository.name,
                    };

                    const userGitId = payload?.sender?.id?.toString();

                    const teamData =
                        await this.runCodeReviewAutomationUseCase.findTeamWithActiveCodeReview(
                            {
                                repository,
                                platformType: PlatformType.GITHUB,
                                userGitId,
                                prNumber: payload.issue.number,
                            },
                        );

                    if (teamData?.organizationAndTeamData) {
                        const data = await this.codeManagement.getPullRequest({
                            organizationAndTeamData:
                                teamData?.organizationAndTeamData,
                            repository,
                            prNumber: payload.issue.number,
                        });

                        pullRequestData = {
                            // TODO: test
                            ...data,
                            pull_request: data,
                        };
                    }
                }

                // Prepare params for the use cases
                const updatedParams = {
                    ...params,
                    payload: {
                        ...payload,
                        action: 'synchronize',
                        origin: 'command',
                        pull_request:
                            pullRequestData ||
                            pullRequest ||
                            payload?.pull_request,
                    },
                };

                // Execute the necessary use cases
                await this.savePullRequestUseCase.execute(updatedParams);
                this.runCodeReviewAutomationUseCase.execute(updatedParams);
                return;
            }

            // For pull_request_review_comment that is not a start-review command
            if (
                event === 'pull_request_review_comment' &&
                !hasReviewMarker &&
                !isStartCommand &&
                kodyMentionPattern.test(comment.body)
            ) {
                this.chatWithKodyFromGitUseCase.execute(params);
                return;
            }
        } catch (error) {
            this.logger.error({
                message: 'Error processing GitHub pull request comment',
                serviceName: GitHubPullRequestHandler.name,
                metadata: {
                    prNumber,
                },
                context: GitHubPullRequestHandler.name,
                error,
            });
        }
    }
}
