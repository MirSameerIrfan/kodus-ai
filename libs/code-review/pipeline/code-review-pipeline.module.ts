import { Module, forwardRef } from '@nestjs/common';

// Stages
import { ValidateNewCommitsStage } from './stages/validate-new-commits.stage';
import { ResolveConfigStage } from './stages/resolve-config.stage';
import { ValidateConfigStage } from './stages/validate-config.stage';
import { FetchChangedFilesStage } from './stages/fetch-changed-files.stage';
import { LoadExternalContextStage } from './stages/load-external-context.stage';
import { FileContextGateStage } from './stages/file-context-gate.stage';
import { InitialCommentStage } from './stages/initial-comment.stage';
import { ProcessFilesPrLevelReviewStage } from './stages/process-files-pr-level-review.stage';
import { ProcessFilesReview } from './stages/process-files-review.stage';
import { CreatePrLevelCommentsStage } from './stages/create-pr-level-comments.stage';
import { CreateFileCommentsStage } from './stages/create-file-comments.stage';
import { AggregateResultsStage } from './stages/aggregate-result.stage';
import { UpdateCommentsAndGenerateSummaryStage } from './stages/finish-comments.stage';
import { RequestChangesOrApproveStage } from './stages/finish-process-review.stage';

// EE Stages

// Interfaces
import { LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN } from './stages/contracts/loadExternalContextStage.contract';
import { WorkflowCoreModule } from '@libs/core/workflow/workflow-core.module';
import { CodeReviewJobProcessorService } from '../workflow/code-review-job-processor.service';
import { FileReviewModule } from '@libs/ee/codeReview/fileReviewContextPreparation/fileReview.module';
import { KodyFineTuningStage } from '@libs/ee/codeReview/stages/kody-fine-tuning.stage';
import { CodeAnalysisASTStage } from '@libs/ee/codeReview/stages/code-analysis-ast.stage';
import { CodeAnalysisASTCleanupStage } from '@libs/ee/codeReview/stages/code-analysis-ast-cleanup.stage';
import { CodeReviewPipelineStrategyEE } from '@libs/ee/codeReview/strategies/code-review-pipeline.strategy.ee';
import { CodeReviewPipelineStrategy } from './strategy/code-review-pipeline.strategy';
import { CodebaseModule } from '../modules/codebase.module';
import { PullRequestMessagesModule } from '../modules/pullRequestMessages.module';
import { PullRequestsModule } from '../modules/pull-requests.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { DryRunCoreModule } from '@libs/dryRun/dry-run-core.module';
import { OrganizationParametersModule } from '@libs/organization/modules/organizationParameters.module';
import { KodyFineTuningContextModule } from '@libs/kodyFineTuning/kodyFineTuningContext.module';
import { AIEngineModule } from '@libs/ai-engine/modules/ai-engine.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { KodyASTAnalyzeContextModule } from '@libs/ee/kodyASTAnalyze/kodyAstAnalyzeContext.module';
import { KodyASTModule } from '@libs/ee/kodyAST/kodyAST.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';

@Module({
    imports: [
        forwardRef(() => CodebaseModule),
        forwardRef(() => FileReviewModule),
        forwardRef(() => PullRequestMessagesModule),
        forwardRef(() => PullRequestsModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => AIEngineModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => KodyFineTuningContextModule),
        forwardRef(() => KodyASTAnalyzeContextModule),
        forwardRef(() => KodyASTModule),
        forwardRef(() => AutomationModule),
        WorkflowCoreModule,
        DryRunCoreModule,
    ],
    providers: [
        // Strategy
        CodeReviewPipelineStrategyEE,
        CodeReviewPipelineStrategy,

        // Job Processor
        CodeReviewJobProcessorService,

        // Stages
        ValidateNewCommitsStage,
        ResolveConfigStage,
        ValidateConfigStage,
        FetchChangedFilesStage,
        {
            provide: LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN,
            useClass: LoadExternalContextStage,
        },
        LoadExternalContextStage,
        FileContextGateStage,
        InitialCommentStage,
        ProcessFilesPrLevelReviewStage,
        ProcessFilesReview,
        CreatePrLevelCommentsStage,
        CreateFileCommentsStage,
        AggregateResultsStage,
        UpdateCommentsAndGenerateSummaryStage,
        RequestChangesOrApproveStage,

        // EE Stages
        KodyFineTuningStage,
        CodeAnalysisASTStage,
        CodeAnalysisASTCleanupStage,
    ],
    exports: [
        CodeReviewPipelineStrategyEE,
        CodeReviewPipelineStrategy,
        CodeReviewJobProcessorService,
        // Export stages if needed by tests or other modules
        CreateFileCommentsStage,
        CreatePrLevelCommentsStage,
        UpdateCommentsAndGenerateSummaryStage,
        ProcessFilesPrLevelReviewStage,
        ProcessFilesReview,
        ResolveConfigStage,
        ValidateConfigStage,
        ValidateNewCommitsStage,
        FetchChangedFilesStage,
        InitialCommentStage,
        AggregateResultsStage,
        LoadExternalContextStage,
        LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN,
    ],
})
export class CodeReviewPipelineModule {}
