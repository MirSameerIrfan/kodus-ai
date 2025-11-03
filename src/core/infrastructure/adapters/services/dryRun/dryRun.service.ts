import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import {
    DRY_RUN_REPOSITORY_TOKEN,
    IDryRunRepository,
} from '@/core/domain/dryRun/contracts/dryRun.repository.contract';
import { IDryRunService } from '@/core/domain/dryRun/contracts/dryRun.service.contract';
import { DryRunEntity } from '@/core/domain/dryRun/entities/dryRun.entity';
import { IDryRun } from '@/core/domain/dryRun/interfaces/dryRun.interface';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLoggerService } from '../logger/pino.service';
import { createHash } from 'crypto';
import { deepSort } from '@/shared/utils/deep';
import { produce } from 'immer';
import { CodeReviewParameter } from '@/config/types/general/codeReviewConfig.type';
import { IPullRequestMessages } from '@/core/domain/pullRequestMessages/interfaces/pullRequestMessages.interface';
import {
    CodeReviewConfig,
    CodeReviewConfigWithoutLLMProvider,
} from '@/config/types/general/codeReview.type';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@/core/domain/parameters/contracts/parameters.service.contract';
import {
    IPullRequestMessagesService,
    PULL_REQUEST_MESSAGES_SERVICE_TOKEN,
} from '@/core/domain/pullRequestMessages/contracts/pullRequestMessages.service.contract';
import { ParametersKey } from '@/shared/domain/enums/parameters-key.enum';
import {
    IFile,
    IPullRequests,
} from '@/core/domain/pullRequests/interfaces/pullRequests.interface';
import {
    CODE_BASE_CONFIG_SERVICE_TOKEN,
    ICodeBaseConfigService,
} from '@/core/domain/codeBase/contracts/CodeBaseConfigService.contract';

@Injectable()
export class DryRunService implements IDryRunService {
    constructor(
        @Inject(DRY_RUN_REPOSITORY_TOKEN)
        private readonly dryRunRepository: IDryRunRepository,

        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,

        @Inject(PULL_REQUEST_MESSAGES_SERVICE_TOKEN)
        private readonly pullRequestMessagesService: IPullRequestMessagesService,

        @Inject(CODE_BASE_CONFIG_SERVICE_TOKEN)
        private readonly codeBaseConfigService: ICodeBaseConfigService,

        private readonly logger: PinoLoggerService,
    ) {}

    create(
        dryRun: Omit<IDryRun, 'uuid' | 'createdAt' | 'updatedAt'>,
    ): Promise<DryRunEntity> {
        try {
            return this.dryRunRepository.create(dryRun);
        } catch (error) {
            this.logger.error({
                message: 'Error creating DryRun',
                error,
                context: DryRunService.name,
                metadata: { dryRun },
            });

            throw error;
        }
    }
    update(uuid: string, dryRun: Partial<IDryRun>): Promise<DryRunEntity> {
        try {
            return this.dryRunRepository.update(uuid, dryRun);
        } catch (error) {
            this.logger.error({
                message: 'Error updating DryRun',
                error,
                context: DryRunService.name,
                metadata: { uuid, dryRun },
            });

            throw error;
        }
    }
    findById(uuid: string): Promise<DryRunEntity | null> {
        try {
            return this.dryRunRepository.findOne({ uuid });
        } catch (error) {
            this.logger.error({
                message: 'Error finding DryRun by ID',
                error,
                context: DryRunService.name,
                metadata: { uuid },
            });

            throw error;
        }
    }
    findOne(filter: Partial<IDryRun>): Promise<DryRunEntity | null> {
        try {
            return this.dryRunRepository.findOne(filter);
        } catch (error) {
            this.logger.error({
                message: 'Error finding DryRun',
                error,
                context: DryRunService.name,
                metadata: { filter },
            });

            throw error;
        }
    }
    find(filter: Partial<IDryRun>): Promise<DryRunEntity[]> {
        try {
            return this.dryRunRepository.find(filter);
        } catch (error) {
            this.logger.error({
                message: 'Error finding DryRuns',
                error,
                context: DryRunService.name,
                metadata: { filter },
            });

            throw error;
        }
    }
    delete(uuid: string): Promise<void> {
        try {
            return this.dryRunRepository.delete(uuid);
        } catch (error) {
            this.logger.error({
                message: 'Error deleting DryRun',
                error,
                context: DryRunService.name,
                metadata: { uuid },
            });

            throw error;
        }
    }

    async addDryRun(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        config: CodeReviewConfig;
        pullRequestMessagesConfig?: IPullRequestMessages;
        provider: IPullRequests['provider'];
        prNumber: number;
        files?: Partial<IFile>[];
        prLevelSuggestions?: Partial<
            IPullRequests['prLevelSuggestions'][number]
        >[];
        repositoryId: string;
        repositoryName: string;
        directoryId?: string;
    }): Promise<IDryRun['runs'][number]> {
        const {
            organizationAndTeamData,
            config,
            pullRequestMessagesConfig,
            ...dryRunData
        } = params;

        try {
            const configParameter = await this.parametersService.findByKey(
                ParametersKey.CODE_REVIEW_CONFIG,
                organizationAndTeamData,
            );

            const { hash, ...configHashes } = this.generateHashes(
                dryRunData,
                config,
                pullRequestMessagesConfig,
            );

            const now = new Date();

            const newDryRun: IDryRun['runs'][number] = {
                ...dryRunData,
                files: params.files || [],
                prLevelSuggestions: params.prLevelSuggestions || [],
                hash,
                createdAt: now,
                updatedAt: now,
                dependents: [],
                configHashes,
                messages: [],
                config: configParameter.uuid,
                description: '',
            };

            const existing = await this.dryRunRepository.findOne({
                organizationId: organizationAndTeamData.organizationId,
                teamId: organizationAndTeamData.teamId,
            });

            // There's no existing DryRun for this org/team, create a new one
            if (!existing) {
                await this.dryRunRepository.create({
                    organizationId: organizationAndTeamData.organizationId,
                    teamId: organizationAndTeamData.teamId,
                    runs: [newDryRun],
                });

                return newDryRun;
            }

            // Check if an identical dry run already exists
            const fullMatch = existing.runs.find((run) => run.hash === hash);
            if (fullMatch) {
                return fullMatch;
            }

            const nextState = produce(existing.toObject(), (draft) => {
                const llmMatch = draft.runs.find(
                    (run) => run.configHashes.llm === configHashes.llm,
                );

                // Check if there's an existing dry run with the same LLM-affecting config
                if (llmMatch) {
                    // Point the new run's files/suggestions to the matched run's hash
                    newDryRun.files = llmMatch.hash;
                    newDryRun.prLevelSuggestions = llmMatch.hash;

                    // Add the new run's hash as a dependent of the matched run
                    llmMatch.dependents.push(hash);
                    llmMatch.updatedAt = now;
                }

                // Add the new run (either modified or as-is) to the list
                draft.runs.push(newDryRun);
            });

            await this.dryRunRepository.update(existing.uuid, {
                runs: nextState.runs,
            });

            return newDryRun;
        } catch (error) {
            this.logger.error({
                message: 'Error adding DryRun',
                error,
                context: DryRunService.name,
                metadata: { organizationAndTeamData, config, dryRunData },
            });

            throw error;
        }
    }

    async addMessageToDryRun(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        hash: string;
        content: string;
        path?: string;
        lines?: {
            start: number;
            end: number;
        };
        severity?: string;
        category?: string;
        codeBlock?: string;
    }): Promise<IDryRun['runs'][number] | null> {
        const { organizationAndTeamData, hash, ...content } = params;

        try {
            const { existing, runIndex } = await this.findRun(
                organizationAndTeamData,
                hash,
            );

            if (!existing || runIndex === -1) {
                return null;
            }

            const now = new Date();

            const nextState = produce(existing.toObject(), (draft) => {
                const length = draft.runs[runIndex].messages?.length || 0;
                draft.runs[runIndex].messages.push({ id: length, ...content });
                draft.runs[runIndex].updatedAt = now;
            });

            const updatedDryRun = await this.dryRunRepository.update(
                existing.uuid,
                { runs: nextState.runs },
            );

            return updatedDryRun.runs[runIndex];
        } catch (error) {
            this.logger.error({
                message: 'Error adding message to DryRun',
                error,
                context: DryRunService.name,
                metadata: { organizationAndTeamData, hash, content },
            });

            throw error;
        }
    }

    async updateMessageInDryRun(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        hash: string;
        commentId: number;
        content: string;
    }): Promise<IDryRun['runs'][number] | null> {
        const { organizationAndTeamData, hash, commentId, content } = params;

        try {
            const { existing, runIndex } = await this.findRun(
                organizationAndTeamData,
                hash,
            );

            if (!existing || runIndex === -1) {
                return null;
            }

            const messageIndex = existing.runs[runIndex].messages.findIndex(
                (msg) => msg.id === commentId,
            );

            if (messageIndex === -1) {
                this.logger.warn({
                    message:
                        'No message found in DryRun run with the specified commentId',
                    context: DryRunService.name,
                    metadata: { organizationAndTeamData, hash, commentId },
                });
                return null;
            }

            const now = new Date();

            const nextState = produce(existing.toObject(), (draft) => {
                draft.runs[runIndex].messages[messageIndex].content = content;
                draft.runs[runIndex].updatedAt = now;
            });

            const updatedDryRun = await this.dryRunRepository.update(
                existing.uuid,
                { runs: nextState.runs },
            );

            return updatedDryRun.runs[runIndex];
        } catch (error) {
            this.logger.error({
                message: 'Error updating message in DryRun',
                error,
                context: DryRunService.name,
                metadata: {
                    organizationAndTeamData,
                    hash,
                    commentId,
                    body: content,
                },
            });

            throw error;
        }
    }

    async updateDescriptionInDryRun(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        hash: string;
        description: string;
    }): Promise<IDryRun['runs'][number] | null> {
        const { organizationAndTeamData, hash, description } = params;

        try {
            const { existing, runIndex } = await this.findRun(
                organizationAndTeamData,
                hash,
            );

            if (!existing || runIndex === -1) {
                return null;
            }

            const now = new Date();

            const nextState = produce(existing.toObject(), (draft) => {
                const run = draft.runs[runIndex];
                run.description = description;
                run.updatedAt = now;
            });

            const updatedDryRun = await this.dryRunRepository.update(
                existing.uuid,
                { runs: nextState.runs },
            );

            return updatedDryRun.runs[runIndex];
        } catch (error) {
            this.logger.error({
                message: 'Error updating description in DryRun',
                error,
                context: DryRunService.name,
                metadata: { organizationAndTeamData, hash, description },
            });

            throw error;
        }
    }

    async removeDryRunByHash(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        hash: string;
    }): Promise<IDryRun | null> {
        const { organizationAndTeamData, hash } = params;

        try {
            const { existing, runIndex: runIndexToRemove } = await this.findRun(
                organizationAndTeamData,
                hash,
            );

            if (!existing || runIndexToRemove === -1) {
                return null;
            }

            const now = new Date();

            const nextState = produce(existing.toObject(), (draft) => {
                const runToRemove = draft.runs[runIndexToRemove];

                // 1. Update parent (if it exists)
                this._updateParentOnRemove(draft, runToRemove, now);

                // 2. Promote dependents (if they exist)
                this._promoteDependentsOnRemove(draft, runToRemove, now);

                // 3. Remove the run itself
                draft.runs.splice(runIndexToRemove, 1);
            });

            const updatedDryRun = await this.dryRunRepository.update(
                existing.uuid,
                { runs: nextState.runs },
            );

            return updatedDryRun.toObject();
        } catch (error) {
            this.logger.error({
                message: 'Error removing DryRun by hash',
                error,
                context: DryRunService.name,
                metadata: { organizationAndTeamData, hash },
            });

            throw error;
        }
    }

    /**
     * Finds the parent of a run-to-be-removed and removes the run from its
     * dependents list.
     */
    private _updateParentOnRemove(
        draft: IDryRun,
        runToRemove: IDryRun['runs'][number],
        now: Date,
    ) {
        if (typeof runToRemove.files !== 'string') {
            return; // This run has no parent
        }

        const parentHash = runToRemove.files;
        const parentRun = draft.runs.find((run) => run.hash === parentHash);

        if (parentRun) {
            parentRun.dependents = parentRun.dependents.filter(
                (depHash) => depHash !== runToRemove.hash,
            );
            parentRun.updatedAt = now;
        }
    }

    /**
     * Promotes the first dependent of a run-to-be-removed to take its place,
     * re-linking other dependents to the new promoted run.
     */
    private _promoteDependentsOnRemove(
        draft: IDryRun,
        runToRemove: IDryRun['runs'][number],
        now: Date,
    ) {
        if (runToRemove.dependents.length === 0) {
            return; // No dependents to promote
        }

        const promotedHash = runToRemove.dependents[0];
        const otherDependentHashes = runToRemove.dependents.slice(1);
        const promotedRun = draft.runs.find((run) => run.hash === promotedHash);

        if (!promotedRun) {
            throw new Error(
                'Inconsistent state: Promoted run not found in runs',
            );
        }

        // 1. Promote the first dependent
        promotedRun.files = runToRemove.files; // Takes parent's files
        promotedRun.prLevelSuggestions = runToRemove.prLevelSuggestions;
        promotedRun.dependents.push(...otherDependentHashes); // Adopts siblings
        promotedRun.updatedAt = now;

        // 2. Re-link all other dependents to the promoted run
        otherDependentHashes.forEach((depHash) => {
            const otherDependentRun = draft.runs.find(
                (run) => run.hash === depHash,
            );
            if (otherDependentRun) {
                otherDependentRun.files = promotedHash;
                otherDependentRun.prLevelSuggestions = promotedHash;
                otherDependentRun.updatedAt = now;
            }
        });
    }

    async clearDryRuns(params: {
        organizationAndTeamData: OrganizationAndTeamData;
    }): Promise<void> {
        const { organizationAndTeamData } = params;

        try {
            const existing = await this.dryRunRepository.findOne({
                organizationId: organizationAndTeamData.organizationId,
                teamId: organizationAndTeamData.teamId,
            });

            if (!existing) {
                return;
            }

            await this.dryRunRepository.update(existing.uuid, { runs: [] });
        } catch (error) {
            this.logger.error({
                message: 'Error clearing DryRuns',
                error,
                context: DryRunService.name,
                metadata: { organizationAndTeamData },
            });

            throw error;
        }
    }

    private generateHashes(
        data: Pick<
            IDryRun['runs'][number],
            'prNumber' | 'repositoryId' | 'directoryId' | 'provider'
        >,
        config: CodeReviewConfigWithoutLLMProvider,
        pullRequestMessages?: IPullRequestMessages,
    ): IDryRun['runs'][number]['configHashes'] &
        Pick<IDryRun['runs'][number], 'hash'> {
        const fullHash = this.generateHash({
            config,
            pullRequestMessages,
            prNumber: data.prNumber,
            repositoryId: data.repositoryId,
            directoryId: data.directoryId,
            provider: data.provider,
        });

        const { v2PromptOverrides, summary, ...restConfig } = config;

        const {
            startReviewMessage,
            endReviewMessage,
            ...restPullRequestMessages
        } = pullRequestMessages || {};

        const { content: contentStart, ...restStartReviewMessage } =
            startReviewMessage || {};
        const { content: contentEnd, ...restEndReviewMessage } =
            endReviewMessage || {};

        const { customInstructions, ...restSummary } = summary;

        const basicConfig = {
            restConfig,
            restPullRequestMessages,
            restStartReviewMessage,
            restEndReviewMessage,
        };

        const llmConfig = {
            contentStart,
            contentEnd,
            v2PromptOverrides,
            customInstructions,
        };

        const basicHash = this.generateHash(basicConfig);
        const llmHash = this.generateHash(llmConfig);

        return {
            hash: fullHash,
            basic: basicHash,
            llm: llmHash,
        };
    }

    private generateHash(config: any): string {
        const sorted = deepSort(config);

        const stringConfig = JSON.stringify(sorted);

        const hash = createHash('sha256').update(stringConfig).digest('hex');

        return hash;
    }

    private async findRun(
        organizationAndTeamData: OrganizationAndTeamData,
        hash: string,
    ) {
        const existing = await this.dryRunRepository.findOne({
            organizationId: organizationAndTeamData.organizationId,
            teamId: organizationAndTeamData.teamId,
        });

        if (!existing) {
            this.logger.warn({
                message: 'No DryRun found for organization and team',
                context: DryRunService.name,
                metadata: { organizationAndTeamData, hash },
            });
            return { existing: null, runIndex: -1, run: null };
        }

        const runIndex = existing.runs.findIndex((run) => run.hash === hash);

        if (runIndex === -1) {
            this.logger.warn({
                message: 'No DryRun run found with the specified hash',
                context: DryRunService.name,
                metadata: { organizationAndTeamData, hash },
            });
            return { existing, runIndex: -1, run: null };
        }

        return { existing, runIndex, run: existing.runs[runIndex] };
    }
}
