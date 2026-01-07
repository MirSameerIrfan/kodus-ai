import { Injectable, Inject } from '@nestjs/common';
import { createLogger } from '@kodus/flow';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import {
    CliReviewInput,
    CliReviewResponse,
} from '@libs/cli-review/domain/types/cli-review.types';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { CliInputConverter } from '@libs/cli-review/infrastructure/converters/cli-input.converter';
import { CliReviewPipelineContext } from '@libs/cli-review/pipeline/context/cli-review-pipeline.context';
import { CliReviewPipelineStrategy } from '@libs/cli-review/pipeline/strategy/cli-review-pipeline.strategy';
import { PipelineExecutor } from '@libs/core/infrastructure/pipeline/services/pipeline-executor.service';
import { v4 as uuidv4 } from 'uuid';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import { ParametersKey } from '@libs/core/domain/enums';
import { CodeReviewConfig } from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { getDefaultKodusConfigFile } from '@libs/common/utils/validateCodeReviewConfigFile';
import { AutomationStatus } from '@libs/automation/domain/automation/enum/automation-status';
import { PipelineError } from '@libs/core/infrastructure/pipeline/interfaces/pipeline-context.interface';

interface ExecuteCliReviewInput {
    organizationAndTeamData: OrganizationAndTeamData;
    input: CliReviewInput;
    isTrialMode?: boolean;
}

/**
 * Use case for executing CLI code review
 * Orchestrates the conversion, pipeline execution, and response formatting
 */
@Injectable()
export class ExecuteCliReviewUseCase implements IUseCase {
    private readonly logger = createLogger(ExecuteCliReviewUseCase.name);

    constructor(
        private readonly converter: CliInputConverter,
        private readonly pipelineStrategy: CliReviewPipelineStrategy,
        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,
    ) {}

    async execute(params: ExecuteCliReviewInput): Promise<CliReviewResponse> {
        const { organizationAndTeamData, input, isTrialMode = false } = params;
        const correlationId = uuidv4();
        const startTime = Date.now();

        try {
            this.logger.log({
                message: 'Starting CLI review',
                context: ExecuteCliReviewUseCase.name,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    teamId: organizationAndTeamData.teamId,
                    correlationId,
                    isTrialMode,
                    isFastMode: input.config?.fast,
                    filesCount: input.config?.files?.length || 0,
                },
            });

            // 1. Convert CLI input to FileChange[]
            const changedFiles = this.converter.convertToFileChanges(input);

            if (changedFiles.length === 0) {
                this.logger.warn({
                    message: 'No files to analyze after conversion',
                    context: ExecuteCliReviewUseCase.name,
                    metadata: { correlationId },
                });

                return {
                    summary: 'No files to analyze',
                    issues: [],
                    filesAnalyzed: 0,
                    duration: Date.now() - startTime,
                };
            }

            // 2. Load or create config
            const codeReviewConfig = isTrialMode
                ? this.getDefaultConfig()
                : await this.loadUserConfig(organizationAndTeamData);

            // 3. Create pipeline context
            const context: CliReviewPipelineContext = {
                organizationAndTeamData,
                codeReviewConfig,
                changedFiles,
                isFastMode: input.config?.fast || !input.config?.files,
                isTrialMode,
                startTime,
                correlationId,
                validSuggestions: [],
                discardedSuggestions: [],
                pipelineVersion: '1.0',
                errors: [] as PipelineError[],
                statusInfo: {
                    status: AutomationStatus.IN_PROGRESS,
                },
            };

            // 4. Execute pipeline
            const pipelineExecutor = new PipelineExecutor<CliReviewPipelineContext>();
            const stages = this.pipelineStrategy.configureStages();
            const pipelineName = this.pipelineStrategy.getPipelineName();

            const result = await pipelineExecutor.execute(
                context,
                stages,
                pipelineName,
            );

            // 5. Return formatted response
            if (!result.cliResponse) {
                throw new Error('Pipeline did not generate CLI response');
            }

            this.logger.log({
                message: 'CLI review completed successfully',
                context: ExecuteCliReviewUseCase.name,
                metadata: {
                    correlationId,
                    issuesFound: result.cliResponse.issues.length,
                    duration: result.cliResponse.duration,
                },
            });

            return result.cliResponse;
        } catch (error) {
            this.logger.error({
                message: 'Error executing CLI review',
                error,
                context: ExecuteCliReviewUseCase.name,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    teamId: organizationAndTeamData.teamId,
                    correlationId,
                },
            });
            throw error;
        }
    }

    /**
     * Load user's code review configuration from database
     */
    private async loadUserConfig(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<CodeReviewConfig> {
        try {
            const params = await this.parametersService.findByKey(
                ParametersKey.CODE_REVIEW_CONFIG,
                organizationAndTeamData,
            );

            if (!params) {
                this.logger.warn({
                    message: 'No config found in database, using defaults',
                    context: ExecuteCliReviewUseCase.name,
                    metadata: { organizationAndTeamData },
                });
                return this.getDefaultConfig();
            }

            const paramObj = params.toObject();
            const config = paramObj.configValue?.configs || this.getDefaultConfig();

            // Ensure required fields are present
            return {
                ...config,
                languageResultPrompt: (config as any).languageResultPrompt || {},
            } as any as CodeReviewConfig;
        } catch (error) {
            this.logger.warn({
                message: 'Error loading config from database, using defaults',
                error,
                context: ExecuteCliReviewUseCase.name,
                metadata: { organizationAndTeamData },
            });
            return this.getDefaultConfig();
        }
    }

    /**
     * Get default code review configuration
     */
    private getDefaultConfig(): CodeReviewConfig {
        const defaults = getDefaultKodusConfigFile();
        return {
            ...defaults,
            automatedReviewActive: true,
            pullRequestApprovalActive: false,
            languageResultPrompt: {},
        } as any as CodeReviewConfig;
    }
}
