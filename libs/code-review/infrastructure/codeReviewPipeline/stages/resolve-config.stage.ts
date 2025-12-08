import { createLogger } from '@kodus/flow';
import { Inject, Injectable } from '@nestjs/common';
import { BaseStage } from './base/base-stage.abstract';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import {
    CODE_BASE_CONFIG_SERVICE_TOKEN,
    ICodeBaseConfigService,
} from '@libs/code-review/domain/contracts/CodeBaseConfigService.contract';
import {
    PULL_REQUEST_MANAGER_SERVICE_TOKEN,
    IPullRequestManagerService,
} from '@libs/code-review/domain/contracts/PullRequestManagerService.contract';
import {
    AutomationMessage,
    AutomationStatus,
} from '@libs/automation/domain/enums/automation-status';
import {
    DRY_RUN_SERVICE_TOKEN,
    IDryRunService,
} from '@libs/dry-run/domain/contracts/dryRun.service.contract';
import { IPullRequestMessages } from '@libs/code-review/domain/pr-messages/interfaces/pullRequestMessages.interface';
import { ConfigLevel } from '@shared/types/general/pullRequestMessages.type';
import {
    IPullRequestMessagesService,
    PULL_REQUEST_MESSAGES_SERVICE_TOKEN,
} from '@libs/code-review/domain/pr-messages/contracts/pullRequestMessages.service.contract';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import { ParametersKey } from '@shared/domain/enums/parameters-key.enum';
import { CODE_BASE_CONFIG_CACHE_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/CodeBaseConfigCacheService.contract';
import { CodeBaseConfigCacheService } from '@libs/code-review/infrastructure/code-base-config-cache.service';

@Injectable()
export class ResolveConfigStage extends BaseStage {
    private readonly logger = createLogger(ResolveConfigStage.name);
    readonly name = 'ResolveConfigStage';
    readonly dependsOn: string[] = []; // No dependencies - can run in parallel with ValidateNewCommitsStage

    constructor(
        @Inject(CODE_BASE_CONFIG_SERVICE_TOKEN)
        private readonly codeBaseConfigService: ICodeBaseConfigService,
        @Inject(CODE_BASE_CONFIG_CACHE_SERVICE_TOKEN)
        private readonly configCacheService: CodeBaseConfigCacheService,
        @Inject(PULL_REQUEST_MANAGER_SERVICE_TOKEN)
        private readonly pullRequestHandlerService: IPullRequestManagerService,
        @Inject(PULL_REQUEST_MESSAGES_SERVICE_TOKEN)
        private readonly pullRequestMessagesService: IPullRequestMessagesService,
        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,
        @Inject(DRY_RUN_SERVICE_TOKEN)
        private readonly dryRunService: IDryRunService,
    ) {
        super();
    }

    async execute(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        try {
            const preliminaryFiles =
                await this.pullRequestHandlerService.getChangedFiles(
                    context.organizationAndTeamData,
                    context.repository,
                    context.pullRequest,
                    [], // Sem ignorePaths ainda, vamos aplicar depois
                    context?.lastExecution?.lastAnalyzedCommit,
                );

            if (!preliminaryFiles || preliminaryFiles.length === 0) {
                this.logger.warn({
                    message: 'No files found in PR',
                    context: this.name,
                    metadata: {
                        organizationAndTeamData:
                            context.organizationAndTeamData,
                        repository: context.repository.name,
                        pullRequestNumber: context.pullRequest.number,
                    },
                });

                return this.updateContext(context, (draft) => {
                    draft.statusInfo = {
                        status: AutomationStatus.SKIPPED,
                        message: AutomationMessage.NO_FILES_IN_PR,
                    };
                });
            }

            // Usar cache service para buscar configuração
            const config = await this.configCacheService.getConfig(
                context.organizationAndTeamData,
                context.repository,
                preliminaryFiles,
            );

            const pullRequestMessagesConfig =
                await this.setPullRequestMessagesConfig(context);

            if (context.dryRun?.enabled) {
                const codeReviewConfigId = (
                    await this.parametersService.findByKey(
                        ParametersKey.CODE_REVIEW_CONFIG,
                        context.organizationAndTeamData,
                    )
                )?.uuid;

                await this.dryRunService.addConfigsToDryRun({
                    id: context.dryRun?.id,
                    organizationAndTeamData: context.organizationAndTeamData,
                    config,
                    configId: codeReviewConfigId,
                    pullRequestMessagesConfig,
                    pullRequestMessagesId: pullRequestMessagesConfig?.uuid,
                });
            }

            return this.updateContext(context, (draft) => {
                draft.codeReviewConfig = config;
                draft.pullRequestMessagesConfig = pullRequestMessagesConfig;
            });
        } catch (error) {
            this.logger.error({
                message: `Error in ResolveConfigStage for PR#${context?.pullRequest?.number}`,
                error,
                context: this.name,
                metadata: {
                    organizationAndTeamData: context?.organizationAndTeamData,
                    prNumber: context?.pullRequest?.number,
                    repositoryId: context?.repository?.id,
                },
            });

            return this.updateContext(context, (draft) => {
                draft.statusInfo = {
                    status: AutomationStatus.SKIPPED,
                    message: AutomationMessage.FAILED_RESOLVE_CONFIG,
                };
            });
        }
    }

    private async setPullRequestMessagesConfig(
        context: CodeReviewPipelineContext,
    ): Promise<IPullRequestMessages | null> {
        const repositoryId = context.repository.id;
        const organizationId = context.organizationAndTeamData.organizationId;

        let pullRequestMessagesConfig = null;

        if (context.codeReviewConfig?.configLevel === ConfigLevel.DIRECTORY) {
            pullRequestMessagesConfig =
                await this.pullRequestMessagesService.findOne({
                    organizationId,
                    repositoryId,
                    directoryId: context.codeReviewConfig?.directoryId,
                    configLevel: ConfigLevel.DIRECTORY,
                });
        }

        if (!pullRequestMessagesConfig) {
            pullRequestMessagesConfig =
                await this.pullRequestMessagesService.findOne({
                    organizationId,
                    repositoryId,
                    configLevel: ConfigLevel.REPOSITORY,
                });
        }

        if (!pullRequestMessagesConfig) {
            pullRequestMessagesConfig =
                await this.pullRequestMessagesService.findOne({
                    organizationId,
                    configLevel: ConfigLevel.GLOBAL,
                });
        }

        return pullRequestMessagesConfig;
    }
}
