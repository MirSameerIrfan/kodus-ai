import { IdGenerator, createLogger } from '@kodus/flow';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AutomationStatus } from '@libs/automation/domain/enums/automation-status';
import { TaskStatus } from '@libs/code-review/ee/ast/codeASTAnalysis.service';
import { CodeReviewPipelineContext } from '@libs/code-review/infrastructure/codeReviewPipeline/context/code-review-pipeline.context';
import { IntegrationConfigKey } from '@libs/core/domain/enums/Integration-config-key.enum';
import { OrganizationParametersKey } from '@libs/core/domain/enums/organization-parameters-key.enum';
import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { DatabaseConnection } from '@libs/core/infrastructure/config/types';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { ObservabilityService } from '@libs/core/infrastructure/logging/observability.service';
import {
    DRY_RUN_SERVICE_TOKEN,
    IDryRunService,
} from '@libs/dry-run/domain/contracts/dryRun.service.contract';
import { DryRunStatus } from '@libs/dry-run/domain/interfaces/dryRun.interface';
import { DryRunCodeReviewPipeline } from '@libs/dry-run/infrastructure/dryRunPipeline';
import {
    IIntegrationConfigService,
    INTEGRATION_CONFIG_SERVICE_TOKEN,
} from '@libs/integrations/domain/configs/contracts/integration-config.service.contracts';
import {
    IOrganizationParametersService,
    ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/org-parameters/contracts/organizationParameters.service.contract';
import { Repositories } from '@libs/platform/domain/platformIntegrations/types/codeManagement/repositories.type';
import { CodeManagementService } from '@libs/platform/infrastructure/services/codeManagement.service';


@Injectable()
export class ExecuteDryRunUseCase {
    private readonly logger = createLogger(ExecuteDryRunUseCase.name);
    private readonly config: DatabaseConnection;

    constructor(
        private readonly dryRunPipeline: DryRunCodeReviewPipeline,
        private readonly observabilityService: ObservabilityService,
        private readonly configService: ConfigService,
        private readonly codeManagementService: CodeManagementService,
        @Inject(DRY_RUN_SERVICE_TOKEN)
        private readonly dryRunService: IDryRunService,
        @Inject(INTEGRATION_CONFIG_SERVICE_TOKEN)
        private readonly integrationConfigService: IIntegrationConfigService,
        @Inject(ORGANIZATION_PARAMETERS_SERVICE_TOKEN)
        private readonly organizationParametersService: IOrganizationParametersService,
    ) {
        this.config =
            this.configService.get<DatabaseConnection>('mongoDatabase');
    }

    async execute(params: {
        organizationAndTeamData: {
            organizationId: string;
            teamId: string;
        };
        repositoryId: string;
        prNumber: number;
    }) {
        try {
            const limit = await this.enforceLimit(
                params.organizationAndTeamData,
            );

            if (limit) {
                return limit;
            }

            const correlationId = IdGenerator.correlationId();

            this.runDryRun({
                correlationId,
                ...params,
            });

            return correlationId;
        } catch (error) {
            this.logger.error({
                message: 'Error starting dry run',
                error,
                metadata: params,
                context: ExecuteDryRunUseCase.name,
            });

            return null;
        }
    }

    private async enforceLimit(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<string | void> {
        const limit = await this.getLimit(organizationAndTeamData);

        const dailyRunCount = await this.getDailyRunCount(
            organizationAndTeamData,
        );

        if (dailyRunCount >= limit) {
            this.logger.warn({
                message: `Dry run limit of ${limit} reached for today`,
                context: ExecuteDryRunUseCase.name,
                serviceName: ExecuteDryRunUseCase.name,
                metadata: {
                    organizationAndTeamData,
                    limit,
                    dailyRunCount,
                },
            });

            return 'Limit.Reached';
        }
    }

    private async getLimit(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<number> {
        const limitConfig = await this.organizationParametersService.findByKey(
            OrganizationParametersKey.DRY_RUN_LIMIT,
            organizationAndTeamData,
        );

        if (!limitConfig) {
            const limit = 5;

            this.logger.warn({
                message: `Dry run limit not set, defaulting to ${limit}`,
                context: ExecuteDryRunUseCase.name,
                serviceName: ExecuteDryRunUseCase.name,
                metadata: {
                    organizationAndTeamData,
                },
            });

            await this.organizationParametersService.createOrUpdateConfig(
                OrganizationParametersKey.DRY_RUN_LIMIT,
                limit,
                organizationAndTeamData,
            );

            return limit;
        }

        return Number(limitConfig.configValue);
    }

    private async getDailyRunCount(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<number> {
        const since = new Date();
        since.setHours(0, 0, 0, 0);

        const until = new Date();
        until.setHours(23, 59, 59, 999);

        const runs = await this.dryRunService.listDryRuns({
            organizationAndTeamData,
            filters: {
                startDate: since,
                endDate: until,
            },
        });

        return runs.length;
    }

    private async runDryRun(params: {
        correlationId: string;
        organizationAndTeamData: {
            organizationId: string;
            teamId: string;
        };
        repositoryId: string;
        prNumber: number;
    }) {
        const {
            correlationId,
            organizationAndTeamData,
            prNumber,
            repositoryId,
        } = params;

        try {
            const platformType = await this.getPlatformType(
                organizationAndTeamData,
            );

            const repository = await this.getRepository(
                repositoryId,
                organizationAndTeamData,
            );

            const pullRequest = await this.getPullRequest(
                organizationAndTeamData,
                repository,
                prNumber,
            );

            const dryRun = await this.dryRunService.initializeDryRun({
                id: correlationId,
                organizationAndTeamData,
                provider: platformType,
                prNumber: pullRequest.number,
                prTitle: pullRequest.title,
                repositoryId: repository.id,
                repositoryName: repository.name,
            });

            await this.observabilityService.initializeObservability(
                this.config,
                {
                    serviceName: 'dryRunCodeReviewPipeline',
                    correlationId,
                },
            );

            const context = {
                dryRun: {
                    enabled: true,
                    id: dryRun.id,
                },
                statusInfo: {
                    status: AutomationStatus.IN_PROGRESS,
                    message: 'Pipeline started',
                },
                organizationAndTeamData,
                platformType,
                pullRequest,
                repository,
                pipelineVersion: '1.0.0',
                errors: [],
                pipelineMetadata: {
                    lastExecution: null,
                },
                batches: [],
                preparedFileContexts: [],
                validSuggestions: [],
                discardedSuggestions: [],
                lastAnalyzedCommit: null,
                validSuggestionsByPR: [],
                validCrossFileSuggestions: [],
                externalPromptContext: {},
                correlationId,
                tasks: {
                    astAnalysis: {
                        taskId: null,
                        status: TaskStatus.TASK_STATUS_UNSPECIFIED,
                    },
                },
            } as unknown as CodeReviewPipelineContext;

            const result = await this.dryRunPipeline.execute(context);

            if (result.dryRun?.id) {
                await this.dryRunService.updateDryRunStatus({
                    organizationAndTeamData,
                    id: result.dryRun.id,
                    status: DryRunStatus.COMPLETED,
                });
            }

            return result;
        } catch (error) {
            this.logger.error({
                message: 'Error executing dry run',
                error,
                metadata: params,
                context: ExecuteDryRunUseCase.name,
            });

            await this.dryRunService.updateDryRunStatus({
                organizationAndTeamData,
                id: correlationId,
                status: DryRunStatus.FAILED,
            });

            return null;
        }
    }

    private async getRepository(
        repositoryId: string,
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<Repositories> {
        const repositories =
            await this.integrationConfigService.findIntegrationConfigFormatted<
                Repositories[]
            >(IntegrationConfigKey.REPOSITORIES, organizationAndTeamData);

        const repository = repositories.find(
            (repo) => repo.id === repositoryId,
        );

        if (!repository) {
            this.logger.warn({
                message: 'Repository not found for dry run',
                context: ExecuteDryRunUseCase.name,
                serviceName: ExecuteDryRunUseCase.name,
                metadata: {
                    organizationAndTeamData,
                    repositoryId,
                },
            });

            throw new Error('Repository not found');
        }

        return repository;
    }

    private async getPlatformType(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<PlatformType> {
        const platform = await this.codeManagementService.getTypeIntegration(
            organizationAndTeamData,
        );

        if (!platform) {
            this.logger.warn({
                message: 'Platform type not found for dry run',
                context: ExecuteDryRunUseCase.name,
                serviceName: ExecuteDryRunUseCase.name,
                metadata: {
                    organizationAndTeamData,
                },
            });

            throw new Error('Platform type not found');
        }

        return platform;
    }

    private async getPullRequest(
        organizationAndTeamData: OrganizationAndTeamData,
        repository: Repositories,
        prNumber: number,
    ) {
        const pr = await this.codeManagementService.getPullRequest({
            organizationAndTeamData,
            repository,
            prNumber,
        });

        if (!pr) {
            this.logger.warn({
                message: 'Pull request not found for dry run',
                context: ExecuteDryRunUseCase.name,
                serviceName: ExecuteDryRunUseCase.name,
                metadata: {
                    organizationAndTeamData,
                    repository,
                    prNumber,
                },
            });

            throw new Error('Pull request not found');
        }

        return pr;
    }
}
