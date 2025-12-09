import { createLogger } from '@kodus/flow';
import { Injectable, Inject } from '@nestjs/common';

import {
    COMMENT_MANAGER_SERVICE_TOKEN,
    ICommentManagerService,
} from '@libs/code-review/domain/contracts/CommentManagerService.contract';
import { BehaviourForNewCommits } from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { PullRequestMessageStatus } from '@libs/core/infrastructure/config/types/general/pullRequestMessages.type';

import { BaseStage } from './base/base-stage.abstract';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';


@Injectable()
export class UpdateCommentsAndGenerateSummaryStage extends BaseStage {
    private readonly logger = createLogger(
        UpdateCommentsAndGenerateSummaryStage.name,
    );
    readonly name = 'UpdateCommentsAndGenerateSummaryStage';
    readonly dependsOn: string[] = ['AggregateResultsStage']; // Depends on AggregateResultsStage

    constructor(
        @Inject(COMMENT_MANAGER_SERVICE_TOKEN)
        private readonly commentManagerService: ICommentManagerService,
    ) {
        super();
    }

    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        const {
            lastExecution,
            codeReviewConfig,
            repository,
            pullRequest,
            organizationAndTeamData,
            platformType,
            initialCommentData,
            lineComments,
        } = context;

        const isCommitRun = Boolean(lastExecution);
        const commitBehaviour =
            codeReviewConfig?.summary?.behaviourForNewCommits ??
            BehaviourForNewCommits.NONE;

        const shouldGenerateOrUpdateSummary =
            (!isCommitRun && codeReviewConfig?.summary?.generatePRSummary) ||
            (isCommitRun &&
                codeReviewConfig?.summary?.generatePRSummary &&
                commitBehaviour !== BehaviourForNewCommits.NONE);

        if (
            !initialCommentData &&
            !context.pullRequestMessagesConfig?.startReviewMessage
        ) {
            this.logger.warn({
                message: `Missing initialCommentData for PR#${pullRequest.number}`,
                context: this.name,
            });
            return context;
        }

        if (shouldGenerateOrUpdateSummary) {
            this.logger.log({
                message: `Generating summary for PR#${pullRequest.number}`,
                context: this.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber: context.pullRequest.number,
                    repository: context.repository,
                },
            });

            const changedFiles = context.changedFiles.map((file) => ({
                filename: file.filename,
                patch: file.patch,
                status: file.status,
            }));

            const summaryPR =
                await this.commentManagerService.generateSummaryPR(
                    pullRequest,
                    repository,
                    changedFiles,
                    organizationAndTeamData,
                    codeReviewConfig.languageResultPrompt,
                    codeReviewConfig.summary,
                    codeReviewConfig?.byokConfig ?? null,
                    isCommitRun,
                    false,
                    context.externalPromptContext,
                );

            await this.commentManagerService.updateSummarizationInPR(
                organizationAndTeamData,
                pullRequest.number,
                repository,
                summaryPR,
                context.dryRun,
            );
        }

        const startReviewMessage =
            context.pullRequestMessagesConfig?.startReviewMessage;
        const endReviewMessage =
            context.pullRequestMessagesConfig?.endReviewMessage;

        if (!endReviewMessage) {
            await this.commentManagerService.updateOverallComment(
                organizationAndTeamData,
                pullRequest.number,
                repository,
                initialCommentData.commentId,
                initialCommentData.noteId,
                platformType,
                lineComments,
                codeReviewConfig,
                initialCommentData.threadId,
                undefined,
                context.dryRun,
            );
            return context;
        }

        if (
            endReviewMessage.status === PullRequestMessageStatus.OFF ||
            endReviewMessage.status === PullRequestMessageStatus.INACTIVE
        ) {
            return context;
        }

        if (
            endReviewMessage.status ===
                PullRequestMessageStatus.ONLY_WHEN_OPENED &&
            context.lastExecution
        ) {
            return context;
        }

        if (
            (endReviewMessage.status === PullRequestMessageStatus.ACTIVE ||
                endReviewMessage.status ===
                    PullRequestMessageStatus.EVERY_PUSH ||
                (endReviewMessage.status ===
                    PullRequestMessageStatus.ONLY_WHEN_OPENED &&
                    !context.lastExecution)) &&
            startReviewMessage &&
            (startReviewMessage.status === PullRequestMessageStatus.ACTIVE ||
                startReviewMessage.status ===
                    PullRequestMessageStatus.EVERY_PUSH ||
                (startReviewMessage.status ===
                    PullRequestMessageStatus.ONLY_WHEN_OPENED &&
                    !context.lastExecution))
        ) {
            const finalCommentBody =
                await this.commentManagerService.processEndReviewMessageTemplate(
                    endReviewMessage.content,
                    context.changedFiles,
                    organizationAndTeamData,
                    pullRequest.number,
                    codeReviewConfig,
                    codeReviewConfig?.languageResultPrompt ?? 'en-US',
                    platformType,
                );

            await this.commentManagerService.updateOverallComment(
                organizationAndTeamData,
                pullRequest.number,
                repository,
                initialCommentData.commentId,
                initialCommentData.noteId,
                platformType,
                lineComments,
                codeReviewConfig,
                initialCommentData.threadId,
                finalCommentBody,
                context.dryRun,
            );
            return context;
        }

        if (
            (endReviewMessage.status === PullRequestMessageStatus.ACTIVE ||
                endReviewMessage.status ===
                    PullRequestMessageStatus.EVERY_PUSH ||
                (endReviewMessage.status ===
                    PullRequestMessageStatus.ONLY_WHEN_OPENED &&
                    !context.lastExecution)) &&
            (!startReviewMessage ||
                startReviewMessage.status ===
                    PullRequestMessageStatus.INACTIVE ||
                startReviewMessage.status === PullRequestMessageStatus.OFF ||
                (startReviewMessage.status ===
                    PullRequestMessageStatus.ONLY_WHEN_OPENED &&
                    context.lastExecution))
        ) {
            const finalCommentBody = endReviewMessage.content;

            await this.commentManagerService.createComment(
                organizationAndTeamData,
                pullRequest.number,
                repository,
                platformType,
                context.changedFiles,
                context.codeReviewConfig?.languageResultPrompt ?? 'en-US',
                lineComments,
                codeReviewConfig,
                finalCommentBody,
                context.pullRequestMessagesConfig,
                context.dryRun,
            );
        }

        return context;
    }

    /**
     * Compensate: Revert summary comment update
     * Note: This is a best-effort compensation - we can't fully revert summary updates
     */
    async compensate(context: CodeReviewPipelineContext): Promise<void> {
        try {
            if (!context.initialCommentData?.commentId) {
                return;
            }

            this.logger.log({
                message: `Compensating: Attempting to revert summary update for PR#${context.pullRequest.number}`,
                context: this.name,
                metadata: {
                    prNumber: context.pullRequest.number,
                    commentId: context.initialCommentData.commentId,
                },
            });

            // Note: Full compensation would require storing the previous comment body
            // For now, we log the compensation attempt
            // In a production system, you might want to store the previous state
            // and restore it here
        } catch (error) {
            this.logger.error({
                message: `Error during compensation for UpdateCommentsAndGenerateSummaryStage`,
                context: this.name,
                error,
                metadata: {
                    prNumber: context.pullRequest.number,
                },
            });
            // Don't throw - compensation failures shouldn't break the workflow
        }
    }
}
