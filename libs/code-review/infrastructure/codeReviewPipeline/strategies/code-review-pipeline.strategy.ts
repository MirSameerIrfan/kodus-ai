/**
 * @license
 * Kodus Tech. All rights reserved.
 */
import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import { BasePipelineStage } from '../../../pipeline/base-stage.abstract';
import { IPipelineStrategy } from '../../../pipeline/interfaces/pipeline-strategy.interface';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import { AggregateResultsStage } from '../stages/aggregate-result.stage';
import {
    ILoadExternalContextStage,
    LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN,
} from '../stages/contracts/loadExternalContextStage.contract';
import { CreateFileCommentsStage } from '../stages/create-file-comments.stage';
import { CreatePrLevelCommentsStage } from '../stages/create-pr-level-comments.stage';
import { FetchChangedFilesStage } from '../stages/fetch-changed-files.stage';
import { FileContextGateStage } from '../stages/file-context-gate.stage';
import { UpdateCommentsAndGenerateSummaryStage } from '../stages/finish-comments.stage';
import { InitialCommentStage } from '../stages/initial-comment.stage';
import { ProcessFilesReview } from '../stages/process-files-review.stage';
import { RequestChangesOrApproveStage } from '../stages/finish-process-review.stage';
import { ProcessFilesPrLevelReviewStage } from '../stages/process-files-pr-level-review.stage';
import { ResolveConfigStage } from '../stages/resolve-config.stage';
import { ValidateConfigStage } from '../stages/validate-config.stage';
import { ValidateNewCommitsStage } from '../stages/validate-new-commits.stage';

@Injectable()
export class CodeReviewPipelineStrategy implements IPipelineStrategy<CodeReviewPipelineContext> {
    constructor(
        private readonly validateNewCommitsStage: ValidateNewCommitsStage,
        private readonly resolveConfigStage: ResolveConfigStage,
        private readonly validateConfigStage: ValidateConfigStage,
        private readonly fetchChangedFilesStage: FetchChangedFilesStage,
        @Inject(LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN)
        private readonly loadExternalContextStage: ILoadExternalContextStage,
        private readonly fileContextGateStage: FileContextGateStage,
        private readonly initialCommentStage: InitialCommentStage,
        private readonly processFilesPrLevelReviewStage: ProcessFilesPrLevelReviewStage,
        private readonly processFilesReview: ProcessFilesReview,
        private readonly createPrLevelCommentsStage: CreatePrLevelCommentsStage,
        private readonly createFileCommentsStage: CreateFileCommentsStage,
        private readonly aggregateResultsStage: AggregateResultsStage,
        private readonly updateCommentsAndGenerateSummaryStage: UpdateCommentsAndGenerateSummaryStage,
        private readonly requestChangesOrApproveStage: RequestChangesOrApproveStage,
    ) {}

    configureStages(): BasePipelineStage<CodeReviewPipelineContext>[] {
        return [
            this.validateNewCommitsStage,
            this.resolveConfigStage,
            this.validateConfigStage,
            this.fetchChangedFilesStage,
            this.loadExternalContextStage,
            this.fileContextGateStage,
            this.initialCommentStage,
            this.processFilesPrLevelReviewStage,
            this.processFilesReview,
            this.createPrLevelCommentsStage,
            this.createFileCommentsStage,
            this.aggregateResultsStage,
            this.updateCommentsAndGenerateSummaryStage,
            this.requestChangesOrApproveStage,
        ];
    }

    getPipelineName(): string {
        return 'CodeReviewPipeline';
    }
}
