import { Module, forwardRef } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

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
import { WorkflowModule } from '@libs/core/workflow/workflow.module';
import { CodeReviewJobProcessorService } from '../workflow/code-review-job-processor.service';
import { FileReviewModule } from '@libs/ee/codeReview/fileReviewContextPreparation/fileReview.module';
import { KodyFineTuningStage } from '@libs/ee/codeReview/stages/kody-fine-tuning.stage';
import { CodeAnalysisASTStage } from '@libs/ee/codeReview/stages/code-analysis-ast.stage';
import { CodeAnalysisASTCleanupStage } from '@libs/ee/codeReview/stages/code-analysis-ast-cleanup.stage';
import { CodeReviewPipelineStrategyEE } from '@libs/ee/codeReview/strategies/code-review-pipeline.strategy.ee';
import { CodebaseModule } from '../modules/codebase.module';

@Module({
    imports: [
        forwardRef(() => CodebaseModule),
        forwardRef(() => FileReviewModule),
        WorkflowModule,
        RabbitMQModule,
    ],
    providers: [
        // Strategy
        CodeReviewPipelineStrategyEE,

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
    ],
})
export class CodeReviewPipelineModule {}
