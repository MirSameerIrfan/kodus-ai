import { DatabaseConnection } from '@/config/types';
import { AutomationStatus } from '@/core/domain/automation/enums/automation-status';
import {
    DRY_RUN_SERVICE_TOKEN,
    IDryRunService,
} from '@/core/domain/dryRun/contracts/dryRun.service.contract';
import { CodeReviewPipelineContext } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/context/code-review-pipeline.context';
import { DryRunCodeReviewPipeline } from '@/core/infrastructure/adapters/services/dryRun/dryRunPipeline';
import { ObservabilityService } from '@/core/infrastructure/adapters/services/logger/observability.service';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { CodeManagementService } from '@/core/infrastructure/adapters/services/platformIntegration/codeManagement.service';
import { TaskStatus } from '@/ee/kodyAST/codeASTAnalysis.service';
import { IdGenerator } from '@kodus/flow';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExecuteDryRunUseCase {
    private readonly config: DatabaseConnection;

    constructor(
        private readonly dryRunPipeline: DryRunCodeReviewPipeline,

        private readonly observabilityService: ObservabilityService,

        private readonly configService: ConfigService,

        private readonly codeManagementService: CodeManagementService,

        private readonly logger: PinoLoggerService,
    ) {
        this.config =
            this.configService.get<DatabaseConnection>('mongoDatabase');
    }

    async execute(params: {
        organizationAndTeamData: {
            organizationId: string;
            teamId: string;
        };
        repository: {
            id: string;
            name: string;
        };
        prNumber: number;
        platformType: string;
    }) {
        const { organizationAndTeamData, prNumber, repository, platformType } =
            params;

        try {
            const correlationId = IdGenerator.correlationId();

            await this.observabilityService.initializeObservability(
                this.config,
                {
                    serviceName: 'dryRunCodeReviewPipeline',
                    correlationId,
                },
            );

            const pullRequest = await this.codeManagementService.getPullRequest(
                {
                    organizationAndTeamData,
                    repository,
                    prNumber,
                },
            );

            const context = {
                dryRun: {
                    enabled: true,
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

            return null;
        } catch (error) {
            this.logger.error({
                message: 'Error executing dry run',
                error,
                metadata: params,
                context: ExecuteDryRunUseCase.name,
            });

            return null;
        }
    }
}
