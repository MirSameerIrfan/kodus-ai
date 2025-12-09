/**
 * @license
 * Kodus Tech. All rights reserved.
 */
import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import { CodeReviewPipelineContext } from '@libs/code-review/infrastructure/codeReviewPipeline/context/code-review-pipeline.context';
import { AggregateResultsStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/aggregate-result.stage';
import {
    ILoadExternalContextStage,
    LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN,
} from '@libs/code-review/infrastructure/codeReviewPipeline/stages/contracts/loadExternalContextStage.contract';
import { CreateFileCommentsStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/create-file-comments.stage';
import { CreatePrLevelCommentsStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/create-pr-level-comments.stage';
import { FetchChangedFilesStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/fetch-changed-files.stage';
import { UpdateCommentsAndGenerateSummaryStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/finish-comments.stage';
import { InitialCommentStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/initial-comment.stage';
import { ValidateConfigStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/validate-config.stage';
import { IPipelineStrategy } from '@libs/core/infrastructure/pipeline/interfaces/pipeline-strategy.interface';
import { PipelineStage } from '@libs/core/infrastructure/pipeline/interfaces/pipeline.interface';
import { ProcessFilesReview } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/process-files-review.stage';
import { RequestChangesOrApproveStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/finish-process-review.stage';

import { CodeAnalysisASTCleanupStage } from '../stages/code-analysis-ast-cleanup.stage';
import { CodeAnalysisASTStage } from '../stages/code-analysis-ast.stage';
import { KodyFineTuningStage } from '../stages/kody-fine-tuning.stage';

import { ProcessFilesPrLevelReviewStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/process-files-pr-level-review.stage';
import { ValidateNewCommitsStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/validate-new-commits.stage';
import { ResolveConfigStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/resolve-config.stage';
import { FileContextGateStage } from '@libs/code-review/infrastructure/codeReviewPipeline/stages/file-context-gate.stage';

@Injectable()
export class CodeReviewPipelineStrategyEE implements IPipelineStrategy<CodeReviewPipelineContext> {
    constructor(
        private readonly validateNewCommitsStage: ValidateNewCommitsStage,
        private readonly resolveConfigStage: ResolveConfigStage,
        private readonly validateConfigStage: ValidateConfigStage,
        private readonly fetchChangedFilesStage: FetchChangedFilesStage,
        @Inject(LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN)
        private readonly loadExternalContextStage: ILoadExternalContextStage,
        private readonly fileContextGateStage: FileContextGateStage,
        private readonly initialCommentStage: InitialCommentStage,
        private readonly kodyFineTuningStage: KodyFineTuningStage,
        private readonly codeAnalysisASTStage: CodeAnalysisASTStage,
        private readonly processFilesPrLevelReviewStage: ProcessFilesPrLevelReviewStage,
        private readonly processFilesReview: ProcessFilesReview,
        private readonly createPrLevelCommentsStage: CreatePrLevelCommentsStage,
        private readonly createFileCommentsStage: CreateFileCommentsStage,
        private readonly codeAnalysisASTCleanupStage: CodeAnalysisASTCleanupStage,
        private readonly aggregateResultsStage: AggregateResultsStage,
        private readonly updateCommentsAndGenerateSummaryStage: UpdateCommentsAndGenerateSummaryStage,
        private readonly requestChangesOrApproveStage: RequestChangesOrApproveStage,
    ) {}

    getPipelineName(): string {
        return 'CodeReviewPipeline';
    }

    configureStages(): PipelineStage<CodeReviewPipelineContext>[] {
        return [
            this.validateNewCommitsStage,
            this.resolveConfigStage,
            this.validateConfigStage,
            this.fetchChangedFilesStage,
            this.loadExternalContextStage,
            this.fileContextGateStage,
            this.initialCommentStage,
            this.kodyFineTuningStage,
            this.codeAnalysisASTStage,
            this.processFilesPrLevelReviewStage,
            this.processFilesReview,
            this.createPrLevelCommentsStage,
            this.createFileCommentsStage,
            this.codeAnalysisASTCleanupStage,
            this.aggregateResultsStage,
            this.updateCommentsAndGenerateSummaryStage,
            this.requestChangesOrApproveStage,
        ];
    }
}
