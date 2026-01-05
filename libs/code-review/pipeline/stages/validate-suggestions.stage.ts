import { createLogger } from '@kodus/flow';
import {
    AST_ANALYSIS_SERVICE_TOKEN,
    IASTAnalysisService,
} from '@libs/code-review/domain/contracts/ASTAnalysisService.contract';
import {
    CodeSuggestion,
    FileChange,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { BasePipelineStage } from '@libs/core/infrastructure/pipeline/abstracts/base-stage.abstract';
import { TaskStatus } from '@libs/ee/kodyAST/interfaces/code-ast-analysis.interface';
import { applyEdit } from '@morphllm/morphsdk';
import { Inject, Injectable } from '@nestjs/common';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';

@Injectable()
export class ValidateSuggestionsStage extends BasePipelineStage<CodeReviewPipelineContext> {
    readonly stageName: string = 'ValidateSuggestionsStage';
    private readonly logger = createLogger(ValidateSuggestionsStage.name);

    constructor(
        @Inject(AST_ANALYSIS_SERVICE_TOKEN)
        private readonly astAnalysisService: IASTAnalysisService,
    ) {
        super();
    }

    protected override async executeStage(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        const validSuggestions = context?.validSuggestions || [];
        const files = context?.changedFiles || [];

        const suggestionsByFilePath = validSuggestions.reduce<{
            [filePath: string]: {
                fileData: FileChange;
                suggestions: Partial<CodeSuggestion>[];
            };
        }>(
            (acc, suggestion) => {
                const file = suggestion.relevantFile;
                if (!acc[file]) {
                    acc[file] = {
                        fileData: files.find((f) => f.filename === file),
                        suggestions: [],
                    };
                }
                acc[file].suggestions.push(suggestion);
                return acc;
            },
            {} as {
                [filePath: string]: {
                    fileData: FileChange;
                    suggestions: Partial<CodeSuggestion>[];
                };
            },
        );

        const patchedFiles = [];

        for (const [filePath, { fileData, suggestions }] of Object.entries(
            suggestionsByFilePath,
        )) {
            const originalCode = fileData?.fileContent;

            if (!originalCode) continue;

            for (const suggestion of suggestions) {
                const result = await applyEdit(
                    {
                        originalCode,
                        codeEdit: suggestion.improvedCode,
                        instructions: suggestion.llmPrompt,
                        filepath: filePath,
                    },
                    {
                        morphApiKey: process.env.API_MORPHLLM_API_KEY,
                    },
                );

                if (!result || !result.mergedCode) {
                    continue;
                }

                const encodedPatch = Buffer.from(result.mergedCode).toString(
                    'base64',
                );

                patchedFiles.push({
                    filePath,
                    encodedPatch,
                });
            }
        }

        const taskId = await this.astAnalysisService.startDiagnostic({
            repository: context.repository,
            pullRequest: context.pullRequest,
            platformType: context.platformType,
            organizationAndTeamData: context.organizationAndTeamData,
            files: patchedFiles,
        });

        const taskRes = await this.astAnalysisService.awaitTask(
            taskId,
            context.organizationAndTeamData,
        );

        if (
            !taskRes ||
            taskRes.task.status !== TaskStatus.TASK_STATUS_COMPLETED
        ) {
            throw new Error('Task failed');
        }

        const result = await this.astAnalysisService.getDiagnostic(taskId);

        return context;
    }
}
