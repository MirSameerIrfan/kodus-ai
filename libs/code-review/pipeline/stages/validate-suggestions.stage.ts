import { createLogger } from '@kodus/flow';
import {
    AST_ANALYSIS_SERVICE_TOKEN,
    IASTAnalysisService,
} from '@libs/code-review/domain/contracts/ASTAnalysisService.contract';
import {
    ASTValidateCodeItem,
    ASTValidateCodeRequest,
    SUPPORTED_LANGUAGES,
} from '@libs/code-review/domain/types/astValidate.type';
import {
    CodeSuggestion,
    FileChange,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { BasePipelineStage } from '@libs/core/infrastructure/pipeline/abstracts/base-stage.abstract';
import { TaskStatus } from '@libs/ee/kodyAST/interfaces/code-ast-analysis.interface';
import { applyEdit } from '@morphllm/morphsdk';
import { Inject, Injectable } from '@nestjs/common';
import pLimit from 'p-limit';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';

@Injectable()
export class ValidateSuggestionsStage extends BasePipelineStage<CodeReviewPipelineContext> {
    readonly stageName: string = 'ValidateSuggestionsStage';
    private readonly logger = createLogger(ValidateSuggestionsStage.name);
    private readonly concurrencyLimit = 10;

    constructor(
        @Inject(AST_ANALYSIS_SERVICE_TOKEN)
        private readonly astAnalysisService: IASTAnalysisService,
    ) {
        super();
    }

    protected override async executeStage(
        context: CodeReviewPipelineContext,
    ): Promise<CodeReviewPipelineContext> {
        const { validSuggestions, changedFiles } = context;

        if (!validSuggestions?.length || !changedFiles?.length) {
            return context;
        }

        const patchedFiles = await this.preparePatchedFiles(
            validSuggestions,
            changedFiles,
        );

        if (patchedFiles.files.length === 0) {
            return context;
        }

        try {
            const validSuggestionIds = await this.validateSuggestions(
                patchedFiles,
                context.organizationAndTeamData,
            );

            return this.updateContext(context, (draft) => {
                if (!draft.codeValidatedSuggestionsIds) {
                    draft.codeValidatedSuggestionsIds = new Set<string>();
                }
                validSuggestionIds.forEach((id) =>
                    draft.codeValidatedSuggestionsIds!.add(id),
                );
            });
        } catch (error) {
            this.logger.error({
                message: 'Error during validation process',
                context: ValidateSuggestionsStage.name,
                error,
            });
        }

        return context;
    }

    private async preparePatchedFiles(
        suggestions: Partial<CodeSuggestion>[],
        files: FileChange[],
    ): Promise<ASTValidateCodeRequest> {
        const suggestionsByFilePath = this.groupSuggestionsByFile(
            suggestions,
            files,
        );

        return this.generatePatchedFiles(suggestionsByFilePath);
    }

    private async validateSuggestions(
        patchedFiles: ASTValidateCodeRequest,
        organizationAndTeamData: any,
    ): Promise<Set<string>> {
        const taskId = await this.startValidationTask(patchedFiles);

        await this.awaitValidationTask(taskId, organizationAndTeamData);

        const validationResults = await this.getValidationResults(
            taskId,
            patchedFiles,
        );

        if (!validationResults?.length) {
            this.logger.warn({
                message: 'No validation results returned',
                context: ValidateSuggestionsStage.name,
            });

            return new Set();
        }

        this.logger.log({
            message: 'Validation results retrieved',
            context: ValidateSuggestionsStage.name,
            metadata: {
                resultsCount: validationResults?.length,
            },
        });

        const passedValidationIds = validationResults
            ?.filter((r) => r.isValid)
            .map((r) => r.id)
            .filter((id): id is string => !!id);

        return new Set(passedValidationIds);
    }

    private groupSuggestionsByFile(
        suggestions: Partial<CodeSuggestion>[],
        files: FileChange[],
    ) {
        return suggestions.reduce<{
            [filePath: string]: {
                fileData: FileChange;
                suggestions: Partial<CodeSuggestion>[];
            };
        }>((acc, suggestion) => {
            const file = suggestion.relevantFile;
            if (!acc[file]) {
                const fileData = files.find((f) => f.filename === file);
                if (fileData) {
                    acc[file] = {
                        fileData,
                        suggestions: [],
                    };
                }
            }
            if (acc[file]) {
                acc[file].suggestions.push(suggestion);
            }
            return acc;
        }, {});
    }

    private isLanguageSupported(filename: string): boolean {
        const extension = filename.slice(filename.lastIndexOf('.'));
        if (!extension || extension === filename) return false;

        return Object.values(SUPPORTED_LANGUAGES).some((lang) =>
            lang.extensions.includes(extension),
        );
    }

    private async generatePatchedFiles(suggestionsByFilePath: {
        [filePath: string]: {
            fileData: FileChange;
            suggestions: Partial<CodeSuggestion>[];
        };
    }): Promise<ASTValidateCodeRequest> {
        const limit = pLimit(this.concurrencyLimit);
        const tasks: Promise<ASTValidateCodeItem | null>[] = [];

        for (const [filePath, { fileData, suggestions }] of Object.entries(
            suggestionsByFilePath,
        )) {
            if (!this.isLanguageSupported(filePath)) {
                this.logger.debug({
                    message: `Skipping validation for unsupported file type: ${filePath}`,
                    context: ValidateSuggestionsStage.name,
                });

                continue;
            }

            const originalCode = fileData?.fileContent;

            if (!originalCode) continue;

            for (const suggestion of suggestions) {
                tasks.push(
                    limit(async () => {
                        try {
                            if (!suggestion.id || !suggestion.improvedCode) {
                                return null;
                            }

                            const result = await applyEdit(
                                {
                                    originalCode,
                                    codeEdit: suggestion.improvedCode,
                                    instructions: suggestion.llmPrompt,
                                    filepath: filePath,
                                },
                                {
                                    morphApiKey:
                                        process.env.API_MORPHLLM_API_KEY,
                                },
                            );

                            if (!result || !result.mergedCode) {
                                return null;
                            }

                            const encodedData = Buffer.from(
                                result.mergedCode,
                            ).toString('base64');

                            return {
                                id: suggestion.id,
                                filePath,
                                encodedData,
                                diff: result.udiff,
                            };
                        } catch (error) {
                            this.logger.error({
                                message: `Error applying edit for suggestion ${suggestion.id}`,
                                context: ValidateSuggestionsStage.name,
                                error,
                                metadata: { filePath },
                            });

                            return null;
                        }
                    }),
                );
            }
        }

        const results = await Promise.allSettled(tasks);

        const files = results
            .filter(
                (
                    result,
                ): result is PromiseFulfilledResult<ASTValidateCodeItem> =>
                    result.status === 'fulfilled' && result.value !== null,
            )
            .map((result) => result.value);

        return { files };
    }

    private async startValidationTask(
        patchedFiles: ASTValidateCodeRequest,
    ): Promise<string> {
        return await this.astAnalysisService.startValidate({
            files: patchedFiles,
        });
    }

    private async awaitValidationTask(
        taskId: string,
        organizationAndTeamData: any,
    ): Promise<void> {
        const taskRes = await this.astAnalysisService.awaitTask(
            taskId,
            organizationAndTeamData,
        );

        if (
            !taskRes ||
            taskRes.task.status !== TaskStatus.TASK_STATUS_COMPLETED
        ) {
            throw new Error('Task failed or timed out');
        }
    }

    private async getValidationResults(
        taskId: string,
        patchedFiles: ASTValidateCodeRequest,
    ): Promise<{ id: string; isValid: boolean }[]> {
        const result = await this.astAnalysisService.getValidate(taskId);

        if (!result) {
            throw new Error('No results returned from validation task');
        }

        const validAstSuggestions = result.results.filter((r) => r.isValid);

        const validationPromises = validAstSuggestions.map(async (r) => {
            if (!r.id) {
                this.logger.warn({
                    message: `Missing ID in validation result for file ${r.filePath}`,
                    context: ValidateSuggestionsStage.name,
                });

                return null;
            }

            const originalFile = patchedFiles.files.find((f) => f.id === r.id);

            if (!originalFile) {
                this.logger.warn({
                    message: `Could not find original request for file ${r.filePath} with ID ${r.id}`,
                    context: ValidateSuggestionsStage.name,
                });

                return null;
            }

            const originalCode = Buffer.from(
                originalFile.encodedData,
                'base64',
            ).toString('utf-8');

            if (!originalCode) {
                this.logger.warn({
                    message: `Original code is empty for file ${r.filePath} with ID ${r.id}`,
                    context: ValidateSuggestionsStage.name,
                });

                return null;
            }

            const llmResult = await this.astAnalysisService.validateWithLLM(
                taskId,
                {
                    code: originalCode,
                    filePath: originalFile.filePath,
                    diff: originalFile.diff,
                    language: originalFile.language,
                },
            );

            if (!llmResult) {
                this.logger.warn({
                    message: `LLM validation returned no result for file ${r.filePath} with ID ${r.id}`,
                    context: ValidateSuggestionsStage.name,
                });

                return null;
            }

            return {
                id: r.id,
                isValid: llmResult.isValid,
            };
        });

        const resultsSettled = await Promise.allSettled(validationPromises);

        const resultsWithLLM = resultsSettled.map((outcome, index) => {
            if (outcome.status === 'fulfilled') {
                if (outcome.value) {
                    return outcome.value;
                }
            } else {
                const originalResult = result.results[index];

                this.logger.error({
                    message: `Error during LLM validation for file ${originalResult?.filePath}`,
                    context: ValidateSuggestionsStage.name,
                    error: outcome.reason,
                    metadata: { id: originalResult?.id },
                });
            }
        });

        return resultsWithLLM;
    }
}
