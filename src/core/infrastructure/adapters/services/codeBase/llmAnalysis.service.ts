import { Inject, Injectable } from '@nestjs/common';
import { IAIAnalysisService } from '../../../../domain/codeBase/contracts/AIAnalysisService.contract';
import {
    FileChangeContext,
    AnalysisContext,
    AIAnalysisResult,
    CodeSuggestion,
    ReviewModeResponse,
    FileChange,
    ISafeguardResponse,
    ReviewModeConfig,
} from '@/config/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import { PinoLoggerService } from '../logger/pino.service';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser, StructuredOutputParser } from '@langchain/core/output_parsers';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { LLMResponseProcessor } from './utils/transforms/llmResponseProcessor.transform';
import { prompt_validateImplementedSuggestions } from '@/shared/utils/langchainCommon/prompts/validateImplementedSuggestions';
import { prompt_selectorLightOrHeavyMode_system } from '@/shared/utils/langchainCommon/prompts/seletorLightOrHeavyMode';
import {
    prompt_codereview_system_gemini,
    prompt_codereview_user_deepseek,
    prompt_codereview_user_gemini,
} from '@/shared/utils/langchainCommon/prompts/configuration/codeReview';
import { prompt_severity_analysis_user } from '@/shared/utils/langchainCommon/prompts/severityAnalysis';
import { LLMProviderService } from '../llmProviders/llmProvider.service';
import { prompt_codeReviewSafeguard_system } from '@/shared/utils/langchainCommon/prompts';
import { LLM_PROVIDER_SERVICE_TOKEN } from '../llmProviders/llmProvider.service.contract';
import {
    LLMModelProvider,
} from '../llmProviders/llmModelProvider.helper';
import { CustomStringOutputParser } from '@/shared/utils/langchainCommon/customStringOutputParser';

// Interface for token tracking
interface TokenUsage {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    model?: string;
    runId?: string;
    parentRunId?: string;
}

// Handler for token tracking
class TokenTrackingHandler extends BaseCallbackHandler {
    name = 'TokenTrackingHandler';
    tokenUsages: TokenUsage[] = [];

    private extractUsageMetadata(output: any): TokenUsage {
        try {
            // Attempts to extract information from different locations in the response
            const usage: TokenUsage = {};

            // Extracts token information
            if (output?.llmOutput?.tokenUsage) {
                Object.assign(usage, output.llmOutput.tokenUsage);
            } else if (output?.llmOutput?.usage) {
                Object.assign(usage, output.llmOutput.usage);
            } else if (output?.generations?.[0]?.[0]?.message?.usage_metadata) {
                const metadata =
                    output.generations[0][0].message.usage_metadata;
                usage.input_tokens = metadata.input_tokens;
                usage.output_tokens = metadata.output_tokens;
                usage.total_tokens = metadata.total_tokens;
            }

            // Extracts model
            usage.model =
                output?.llmOutput?.model ||
                output?.generations?.[0]?.[0]?.message?.response_metadata
                    ?.model ||
                'unknown';

            return usage;
        } catch (error) {
            console.error('Error extracting usage metadata:', error);
            return {};
        }
    }

    async handleLLMEnd(
        output: any,
        runId: string,
        parentRunId?: string,
        tags?: string[],
    ) {
        const usage = this.extractUsageMetadata(output);

        if (Object.keys(usage).length > 0) {
            this.tokenUsages.push({
                ...usage,
                runId,
                parentRunId,
            });
        }
    }

    getTokenUsages(): TokenUsage[] {
        return this.tokenUsages;
    }

    reset() {
        this.tokenUsages = [];
    }
}

export const LLM_ANALYSIS_SERVICE_TOKEN = Symbol('LLMAnalysisService');

@Injectable()
export class LLMAnalysisService implements IAIAnalysisService {
    private readonly tokenTracker: TokenTrackingHandler;
    private readonly llmResponseProcessor: LLMResponseProcessor;

    constructor(
        private readonly logger: PinoLoggerService,
        @Inject(LLM_PROVIDER_SERVICE_TOKEN)
        private readonly llmProviderService: LLMProviderService,
    ) {
        this.tokenTracker = new TokenTrackingHandler();
        this.llmResponseProcessor = new LLMResponseProcessor(logger);
    }

    //#region Helper Functions
    // Creates the prefix for the prompt cache (every prompt that uses file or codeDiff must start with this)
    private preparePrefixChainForCache(
        context: {
            patchWithLinesStr: string;
            fileContent: string;
            relevantContent: string;
            language: string;
            filePath: string;
            suggestions?: CodeSuggestion[];
        },
        reviewMode: ReviewModeResponse,
    ) {
        if (!context?.patchWithLinesStr) {
            throw new Error('Required context parameters are missing');
        }

        if (reviewMode === ReviewModeResponse.LIGHT_MODE) {
            return {
                type: 'text',
                text: `
## Context

<codeDiff>
    ${context.patchWithLinesStr}
</codeDiff>

<filePath>
    ${context.filePath}
</filePath>

<suggestionsContext>
    ${JSON.stringify(context?.suggestions, null, 2) || 'No suggestions provided'}
</suggestionsContext>`,
            };
        }

        return {
            type: 'text',
            text: `
## Context

<fileContent>
    ${context.relevantContent || context.fileContent}
</fileContent>

<codeDiff>
    ${context.patchWithLinesStr}
</codeDiff>

<filePath>
    ${context.filePath}
</filePath>

<suggestionsContext>
${JSON.stringify(context?.suggestions, null, 2) || 'No suggestions provided'}
</suggestionsContext>`,
        };
    }

    private async logTokenUsage(metadata: any) {
        // Log token usage for analysis and monitoring
        this.logger.log({
            message: 'Token usage',
            context: LLMAnalysisService.name,
            metadata: {
                ...metadata,
            },
        });
    }
    //#endregion

    //#region Analyze Code with AI
    async analyzeCodeWithAI(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        fileContext: FileChangeContext,
        reviewModeResponse: ReviewModeResponse,
        context: AnalysisContext,
    ): Promise<AIAnalysisResult> {
        const provider = LLMModelProvider.GEMINI_2_5_PRO;

        // Reset token tracking for new analysis
        this.tokenTracker.reset();

        // Prepare base context
        const baseContext = await this.prepareAnalysisContext(
            fileContext,
            context,
        );

        try {
            // Create chain with fallback
            const chain = await this.createAnalysisChainWithFallback(
                provider,
                baseContext,
                reviewModeResponse,
            );

            // Execute analysis
            const result = await chain.invoke(baseContext);

            // Process result and tokens
            const analysisResult = this.llmResponseProcessor.processResponse(
                organizationAndTeamData,
                prNumber,
                result,
            );

            if (!analysisResult) {
                return null;
            }

            analysisResult.codeReviewModelUsed = {
                generateSuggestions: provider,
            };

            return analysisResult;
        } catch (error) {
            this.logger.error({
                message: `Error during LLM code analysis for PR#${prNumber}`,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData: context?.organizationAndTeamData,
                    prNumber: context?.pullRequest?.number,
                },
                error,
            });
            throw error;
        }
    }

    private async prepareAnalysisContext(
        fileContext: FileChangeContext,
        context: AnalysisContext,
    ) {
        const baseContext = {
            pullRequest: context?.pullRequest,
            patchWithLinesStr: fileContext?.patchWithLinesStr,
            maxSuggestionsParams:
                context.codeReviewConfig?.suggestionControl?.maxSuggestions,
            language: context?.repository?.language,
            filePath: fileContext?.file?.filename,
            languageResultPrompt:
                context?.codeReviewConfig?.languageResultPrompt,
            reviewOptions: context?.codeReviewConfig?.reviewOptions,
            fileContent: fileContext?.file?.fileContent,
            limitationType:
                context?.codeReviewConfig?.suggestionControl?.limitationType,
            severityLevelFilter:
                context?.codeReviewConfig?.suggestionControl
                    ?.severityLevelFilter,
            groupingMode:
                context?.codeReviewConfig?.suggestionControl?.groupingMode,
            organizationAndTeamData: context?.organizationAndTeamData,
            relevantContent: fileContext?.relevantContent,
        };

        return baseContext;
    }

    private async createAnalysisChainWithFallback(
        provider: LLMModelProvider,
        context: any,
        reviewMode: ReviewModeResponse,
    ) {
        const fallbackProvider = LLMModelProvider.NOVITA_DEEPSEEK_V3;

        try {
            const mainChain = await this.createAnalysisProviderChain(
                provider,
                reviewMode,
            );
            const fallbackChain = await this.createAnalysisProviderChain(
                fallbackProvider,
                reviewMode,
            );

            // Use withFallbacks to properly configure the fallback
            return mainChain
                .withFallbacks({
                    fallbacks: [fallbackChain],
                })
                .withConfig({
                    runName: 'analyzeCodeWithAI',
                    metadata: {
                        organizationId:
                            context?.organizationAndTeamData?.organizationId,
                        teamId: context?.organizationAndTeamData?.teamId,
                        pullRequestId: context?.pullRequest?.number,
                        provider: provider,
                        fallbackProvider: fallbackProvider,
                        reviewMode: reviewMode,
                    },
                });
        } catch (error) {
            this.logger.error({
                message: 'Error creating analysis chain with fallback',
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    provider,
                    fallbackProvider,
                },
            });
            throw error;
        }
    }

    private async createAnalysisProviderChain(
        provider: LLMModelProvider,
        reviewModeResponse: ReviewModeResponse,
    ) {
        try {
            let llm = this.llmProviderService.getLLMProvider({
                model: provider,
                temperature: 0,
                jsonMode: true,
                callbacks: [this.tokenTracker],
            });

            if (provider === LLMModelProvider.NOVITA_DEEPSEEK_V3) {
                const lightModeChain = RunnableSequence.from([
                    async (input: any) => {
                        return [
                            {
                                role: 'user',
                                content: [
                                    {
                                        type: 'text',
                                        text: prompt_codereview_user_deepseek(
                                            input,
                                        ),
                                    },
                                ],
                            },
                        ];
                    },
                    llm,
                    new CustomStringOutputParser(),
                ]);

                return lightModeChain;
            }

            const chain = RunnableSequence.from([
                async (input: any) => {
                    return [
                        {
                            role: 'system',
                            content: [
                                {
                                    type: 'text',
                                    text: prompt_codereview_system_gemini(
                                        input,
                                    ),
                                },
                            ],
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text:
                                        prompt_codereview_user_gemini(input) ||
                                        '',
                                },
                            ],
                        },
                    ];
                },
                llm,
                new CustomStringOutputParser(),
            ]);

            return chain;
        } catch (error) {
            this.logger.error({
                message: 'Error creating analysis code chain',
                error,
                context: LLMAnalysisService.name,
                metadata: { provider },
            });
            throw error;
        }
    }
    //#endregion

    //#region Generate Code Suggestions
    private async createSuggestionsChainWithFallback(
        provider: LLMModelProvider,
        reviewMode: ReviewModeResponse,
    ) {
        const fallbackProvider =
            provider === LLMModelProvider.OPENAI_GPT_4O
                ? LLMModelProvider.GEMINI_2_5_PRO
                : LLMModelProvider.OPENAI_GPT_4O;
        try {
            // Main chain
            const mainChain = await this.createAnalysisChainWithFallback(
                provider,
                {},
                reviewMode,
            );

            const fallbackChain = await this.createAnalysisChainWithFallback(
                fallbackProvider,
                {},
                reviewMode,
            );

            // Combine with fallback
            return RunnableSequence.from([mainChain, fallbackChain]);
        } catch (error) {
            this.logger.error({
                message: 'Error creating suggestions chain with fallback',
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    provider,
                    fallbackProvider,
                },
            });
            throw error;
        }
    }

    async generateCodeSuggestions(
        organizationAndTeamData: OrganizationAndTeamData,
        sessionId: string,
        question: string,
        parameters: any,
        reviewMode: ReviewModeResponse = ReviewModeResponse.LIGHT_MODE,
    ) {
        const provider =
            parameters.llmProvider || LLMModelProvider.GEMINI_2_5_PRO;

        // Reset token tracking for new suggestions
        this.tokenTracker.reset();

        try {
            const chain = await this.createSuggestionsChainWithFallback(
                provider,
                reviewMode,
            );
            const result = await chain.invoke({ question });

            // Log token usage
            const tokenUsages = this.tokenTracker.getTokenUsages();
            await this.logTokenUsage({
                tokenUsages,
                organizationAndTeamData,
                sessionId,
                parameters,
            });
            return result;
        } catch (error) {
            this.logger.error({
                message: `Error generating code suggestions`,
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    sessionId,
                    parameters,
                },
            });
            throw error;
        }
    }
    //#endregion

    //#region Severity Analysis
    private async createSeverityAnalysisChain(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        codeSuggestions: CodeSuggestion[],
    ) {
        try {
            let llm = this.llmProviderService.getLLMProvider({
                model: provider,
                temperature: 0,
                jsonMode: true,
                callbacks: [this.tokenTracker],
            });

            const chain = RunnableSequence.from([
                async (input: any) => {
                    const humanPrompt = prompt_severity_analysis_user(
                        codeSuggestions?.map((s) => ({
                            id: s.id,
                            label: s.label,
                            suggestionContent: s.suggestionContent,
                            existingCode: s.existingCode,
                            improvedCode: s.improvedCode,
                        })),
                    );

                    return [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: humanPrompt,
                                },
                            ],
                        },
                    ];
                },
                llm,
                new StringOutputParser(),
            ]);

            return chain;
        } catch (error) {
            this.logger.error({
                message: `Error creating severity analysis chain for PR#${prNumber}`,
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData: organizationAndTeamData,
                    prNumber: prNumber,
                    provider,
                },
            });
        }
    }

    public async createSeverityAnalysisChainWithFallback(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        codeSuggestions: CodeSuggestion[],
    ) {
        const fallbackProvider =
            provider === LLMModelProvider.OPENAI_GPT_4O
                ? LLMModelProvider.NOVITA_DEEPSEEK_V3_0324
                : LLMModelProvider.OPENAI_GPT_4O;

        try {
            // Chain principal
            const mainChain = await this.createSeverityAnalysisChain(
                organizationAndTeamData,
                prNumber,
                provider,
                codeSuggestions,
            );

            // Chain de fallback
            const fallbackChain = await this.createSeverityAnalysisChain(
                organizationAndTeamData,
                prNumber,
                fallbackProvider,
                codeSuggestions,
            );

            // Configurar chain com fallback
            return mainChain
                .withFallbacks({
                    fallbacks: [fallbackChain],
                })
                .withConfig({
                    runName: 'severityAnalysis',
                    metadata: {
                        organizationId: organizationAndTeamData?.organizationId,
                        teamId: organizationAndTeamData?.teamId,
                        pullRequestId: prNumber,
                        provider: provider,
                        fallbackProvider: fallbackProvider,
                    },
                });
        } catch (error) {
            this.logger.error({
                message: 'Error creating severity analysis chain with fallback',
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    provider,
                    fallbackProvider,
                    organizationAndTeamData: organizationAndTeamData,
                    prNumber: prNumber,
                },
            });
            throw error;
        }
    }

    async severityAnalysisAssignment(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        codeSuggestions: CodeSuggestion[],
    ): Promise<Partial<CodeSuggestion>[]> {
        const baseContext = {
            organizationAndTeamData,
            prNumber,
            codeSuggestions,
        };

        const chain = await this.createSeverityAnalysisChainWithFallback(
            organizationAndTeamData,
            prNumber,
            provider,
            codeSuggestions,
        );

        try {
            const result = await chain.invoke(baseContext);

            const suggestionsWithSeverityAnalysis =
                this.llmResponseProcessor.processResponse(
                    organizationAndTeamData,
                    prNumber,
                    result,
                );

            const suggestionsWithSeverity =
                suggestionsWithSeverityAnalysis?.codeSuggestions || [];

            return suggestionsWithSeverity;
        } catch (error) {
            this.logger.error({
                message:
                    'Error executing validate implemented suggestions chain:',
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    provider,
                },
            });
        }

        return codeSuggestions;
    }
    //#endregion

    //#region Filter Suggestions Safe Guard
    async filterSuggestionsSafeGuard(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        file: any,
        relevantContent: string,
        codeDiff: string,
        suggestions: any[],
        languageResultPrompt: string,
        reviewMode: ReviewModeResponse,
    ): Promise<ISafeguardResponse> {
        try {
            suggestions?.forEach((suggestion) => {
                if (
                    suggestion &&
                    Object.prototype.hasOwnProperty.call(
                        suggestion,
                        'suggestionEmbedded',
                    )
                ) {
                    delete suggestion?.suggestionEmbedded;
                }
            });

            const provider = LLMModelProvider.GEMINI_2_5_PRO;
            const baseContext = {
                organizationAndTeamData,
                file: {
                    ...file,
                    fileContent: file.fileContent,
                },
                relevantContent,
                codeDiff,
                suggestions,
                languageResultPrompt,
            };

            // Create chain with fallback
            const chain = await this.createSafeGuardChainWithFallback(
                organizationAndTeamData,
                prNumber,
                provider,
                reviewMode,
                baseContext,
            );

            // Execute analysis
            const response = await chain.invoke(baseContext);

            const tokenUsages = this.tokenTracker.getTokenUsages();

            const filteredSuggestions =
                await this.extractSuggestionsFromCodeReviewSafeguard(
                    organizationAndTeamData,
                    prNumber,
                    response,
                );

            // Filter and update suggestions
            const suggestionsToUpdate =
                filteredSuggestions?.codeSuggestions?.filter(
                    (s) => s.action === 'update',
                );
            const suggestionsToDiscard = new Set(
                filteredSuggestions?.codeSuggestions
                    ?.filter((s) => s.action === 'discard')
                    .map((s) => s.id),
            );

            this.logTokenUsage({
                tokenUsages,
                pullRequestId: prNumber,
                fileContext: file?.filename,
                provider,
                organizationAndTeamData,
            });

            const filteredAndMappedSuggestions = suggestions
                ?.filter(
                    (suggestion) => !suggestionsToDiscard.has(suggestion.id),
                )
                ?.map((suggestion) => {
                    const updatedSuggestion = suggestionsToUpdate?.find(
                        (s) => s.id === suggestion.id,
                    );

                    if (!updatedSuggestion) {
                        return suggestion;
                    }

                    return {
                        ...suggestion,
                        suggestionContent: updatedSuggestion?.suggestionContent,
                        existingCode: updatedSuggestion?.existingCode,
                        improvedCode: updatedSuggestion?.improvedCode,
                        oneSentenceSummary:
                            updatedSuggestion?.oneSentenceSummary,
                        relevantLinesStart:
                            updatedSuggestion?.relevantLinesStart,
                        relevantLinesEnd: updatedSuggestion?.relevantLinesEnd,
                    };
                });

            return {
                suggestions: filteredAndMappedSuggestions,
                codeReviewModelUsed: {
                    safeguard: provider,
                },
            };
        } catch (error) {
            this.logger.error({
                message: `Error during suggestions safe guard analysis for PR#${prNumber}`,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    file: file?.filename,
                },
                error,
            });
            return { suggestions };
        }
    }

    private async createSafeGuardChainWithFallback(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        reviewMode: ReviewModeResponse,
        context: any,
    ) {
        const fallbackProvider = LLMModelProvider.VERTEX_CLAUDE_3_5_SONNET;

        try {
            const mainChain = await this.createSafeGuardProviderChain(
                organizationAndTeamData,
                prNumber,
                provider,
                reviewMode,
                context,
            );
            const fallbackChain = await this.createSafeGuardProviderChain(
                organizationAndTeamData,
                prNumber,
                fallbackProvider,
                reviewMode,
                context,
            );

            return mainChain
                .withFallbacks({
                    fallbacks: [fallbackChain],
                })
                .withConfig({
                    runName: 'filterSuggestionsSafeGuard',
                    metadata: {
                        organizationId:
                            context?.organizationAndTeamData?.organizationId,
                        teamId: context?.organizationAndTeamData?.teamId,
                        pullRequestId: prNumber,
                        provider: provider,
                        fallbackProvider: fallbackProvider,
                        reviewMode: reviewMode,
                    },
                });
        } catch (error) {
            this.logger.error({
                message: 'Error creating safe guard chain with fallback',
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    provider,
                    fallbackProvider,
                    organizationAndTeamData,
                    prNumber,
                },
            });
            throw error;
        }
    }

    private async createSafeGuardProviderChain(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        reviewMode: ReviewModeResponse,
        context?: any,
    ) {
        try {
            let llm = this.llmProviderService.getLLMProvider({
                model: provider,
                temperature: 0,
                jsonMode: true,
                callbacks: [this.tokenTracker],
            });

            const chain = RunnableSequence.from([
                async (input: any) => {
                    const systemPrompt = prompt_codeReviewSafeguard_system(
                        input.languageResultPrompt,
                    );

                    return [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        {
                            role: 'user',
                            content: [
                                this.preparePrefixChainForCache(
                                    {
                                        fileContent: input.file.fileContent,
                                        relevantContent: input.relevantContent,
                                        patchWithLinesStr: input.codeDiff,
                                        language: input.file.language,
                                        filePath: input.file.filename,
                                        suggestions: input?.suggestions,
                                    },
                                    reviewMode,
                                ),
                            ],
                        },
                    ];
                },
                llm,
                new CustomStringOutputParser(),
            ]);

            return chain;
        } catch (error) {
            this.logger.error({
                message: `Error creating safe guard provider chain for PR#${prNumber}`,
                error,
                context: LLMAnalysisService.name,
                metadata: { organizationAndTeamData, prNumber, provider },
            });
            throw error;
        }
    }

    private async extractSuggestionsFromText(
        text: string,
    ): Promise<CodeSuggestion[]> {
        try {
            const regex = /\{[\s\S]*"codeSuggestions"[\s\S]*\}/;
            const match = text.match(regex);

            if (!match) {
                throw new Error('No JSON with codeSuggestions found');
            }

            return JSON.parse(match[0]);
        } catch (error) {
            throw new Error(`Failed to extract suggestions: ${error.message}`);
        }
    }

    async extractSuggestionsFromCodeReviewSafeguard(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        safeGuardResponse: any,
    ) {
        try {
            try {
                return await this.extractSuggestionsFromText(safeGuardResponse);
            } catch (error) {
                this.logger.warn({
                    message: `Failed to extract suggestions using code for PR#${prNumber}, falling back to LLM`,
                    context: LLMAnalysisService.name,
                    error,
                    metadata: {
                        organizationAndTeamData,
                        prNumber,
                    },
                });

                // Fallback for LLM
                const provider = LLMModelProvider.OPENAI_GPT_4O_MINI;
                const baseContext = { safeGuardResponse };

                const chain =
                    await this.createExtractSuggestionsChainWithFallback(
                        organizationAndTeamData,
                        prNumber,
                        provider,
                        baseContext,
                    );

                return await chain.invoke(baseContext);
            }
        } catch (error) {
            this.logger.error({
                message: `Error extracting suggestions from safe guard response for PR#${prNumber}`,
                context: LLMAnalysisService.name,
                error,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                },
            });
            throw error;
        }
    }

    private async createExtractSuggestionsChainWithFallback(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        context: any,
    ) {
        try {
            const mainChain = await this.createExtractSuggestionsProviderChain(
                organizationAndTeamData,
                prNumber,
                provider,
                context,
            );
            const fallbackProvider =
                provider === LLMModelProvider.OPENAI_GPT_4O_MINI
                    ? LLMModelProvider.OPENAI_GPT_4O
                    : LLMModelProvider.OPENAI_GPT_4O_MINI;
            const fallbackChain =
                await this.createExtractSuggestionsProviderChain(
                    organizationAndTeamData,
                    prNumber,
                    fallbackProvider,
                    context,
                );

            return mainChain
                .withFallbacks({
                    fallbacks: [fallbackChain],
                })
                .withConfig({
                    runName: 'extractSuggestionsFromCodeReviewSafeguard',
                    metadata: {
                        organizationId: organizationAndTeamData?.organizationId,
                        teamId: organizationAndTeamData?.teamId,
                        pullRequestId: context?.pullRequest?.number,
                        provider: provider,
                        fallbackProvider: fallbackProvider,
                    },
                });
        } catch (error) {
            this.logger.error({
                message: `Error creating chain with fallback for PR#${prNumber}`,
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    provider,
                },
            });
            throw error;
        }
    }

    private async createExtractSuggestionsProviderChain(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        context: any,
    ) {
        try {
            let llm = this.llmProviderService.getLLMProvider({
                model: provider,
                temperature: 0,
                callbacks: [this.tokenTracker],
            });

            // Definir o schema Zod para validação em runtime (não para inferência de tipo)
            const suggestionSchema = z.object({
                codeSuggestions: z.array(
                    z.object({
                        id: z.string(),
                        suggestionContent: z.string(),
                        existingCode: z.string(),
                        improvedCode: z.string(),
                        oneSentenceSummary: z.string(),
                        relevantLinesStart: z.string(),
                        relevantLinesEnd: z.string(),
                        label: z.string().optional(),
                        action: z.string(),
                        reason: z.string().optional(),
                    }).refine(
                        (data) =>
                            data.suggestionContent &&
                            data.existingCode &&
                            data.oneSentenceSummary &&
                            data.relevantLinesStart &&
                            data.relevantLinesEnd &&
                            data.action,
                        {
                            message: 'All fields are required',
                        },
                    )
                ),
            });

            // Criar um parser compatível com a interface do StructuredOutputParser
            // mas sem usar a função fromZodSchema que causa o erro TS2589
            const parser = {
                getFormatInstructions: () => {
                    return `Return a JSON object with the following schema:\n${JSON.stringify({
                        codeSuggestions: [{
                            id: "string",
                            suggestionContent: "string",
                            existingCode: "string",
                            improvedCode: "string",
                            oneSentenceSummary: "string",
                            relevantLinesStart: "string",
                            relevantLinesEnd: "string",
                            label: "string (optional)",
                            action: "string",
                            reason: "string (optional)"
                        }]
                    }, null, 2)}\n\nAll fields are required except 'label' and 'reason'.`;
                },
                parse: async (text: string) => {
                    try {
                        const json = JSON.parse(text);
                        return suggestionSchema.parse(json);
                    } catch (e) {
                        throw new Error(`Failed to parse output: ${e.message}`);
                    }
                }
            };

            const formatInstructions = parser.getFormatInstructions();

            const chain = RunnableSequence.from([
                async (input: any) => {
                    const prompt = `${input.safeGuardResponse}\n\n${formatInstructions}`;
                    return [new HumanMessage({ content: prompt })];
                },
                llm,
                new StringOutputParser(),
                parser.parse.bind(parser),
            ]);

            return chain;
        } catch (error) {
            this.logger.error({
                message: `Error creating extract suggestions provider chain for PR#${prNumber}`,
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    provider,
                },
            });
            throw error;
        }
    }
    //#endregion

    //#region Validate Implemented Suggestions
    async validateImplementedSuggestions(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        codePatch: string,
        codeSuggestions: Partial<CodeSuggestion>[],
    ): Promise<Partial<CodeSuggestion>[]> {
        const baseContext = {
            organizationAndTeamData,
            prNumber,
            codePatch,
            codeSuggestions,
        };

        const chain =
            await this.createValidateImplementedSuggestionsChainWithFallback(
                organizationAndTeamData,
                prNumber,
                provider,
                baseContext,
            );

        try {
            const result = await chain.invoke(baseContext);

            const suggestionsWithImplementedStatus =
                this.llmResponseProcessor.processResponse(
                    organizationAndTeamData,
                    prNumber,
                    result,
                );

            const implementedSuggestions =
                suggestionsWithImplementedStatus?.codeSuggestions || [];

            return implementedSuggestions;
        } catch (error) {
            this.logger.error({
                message:
                    'Error executing validate implemented suggestions chain:',
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    provider,
                },
            });
        }

        return codeSuggestions;
    }

    private async createValidateImplementedSuggestionsChainWithFallback(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        context: any,
    ) {
        const fallbackProvider =
            provider === LLMModelProvider.OPENAI_GPT_4O
                ? LLMModelProvider.NOVITA_DEEPSEEK_V3_0324
                : LLMModelProvider.OPENAI_GPT_4O;

        try {
            // Chain principal
            const mainChain =
                await this.createValidateImplementedSuggestionsChain(
                    organizationAndTeamData,
                    prNumber,
                    provider,
                    context,
                );

            // Chain de fallback
            const fallbackChain =
                await this.createValidateImplementedSuggestionsChain(
                    organizationAndTeamData,
                    prNumber,
                    fallbackProvider,
                    context,
                );

            // Configurar chain com fallback
            return mainChain
                .withFallbacks({
                    fallbacks: [fallbackChain],
                })
                .withConfig({
                    runName: 'validateImplementedSuggestions',
                    metadata: {
                        organizationId: organizationAndTeamData?.organizationId,
                        teamId: organizationAndTeamData?.teamId,
                        pullRequestId: prNumber,
                        provider: provider,
                        fallbackProvider: fallbackProvider,
                    },
                });
        } catch (error) {
            this.logger.error({
                message:
                    'Error creating validate implemented suggestions chain with fallback',
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    provider,
                    fallbackProvider,
                    organizationAndTeamData: organizationAndTeamData,
                    prNumber: prNumber,
                },
            });
            throw error;
        }
    }

    private async createValidateImplementedSuggestionsChain(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        context: any,
    ) {
        try {
            let llm = this.llmProviderService.getLLMProvider({
                model: provider,
                temperature: 0,
                callbacks: [this.tokenTracker],
                jsonMode: true,
            });

            const chain = RunnableSequence.from([
                async (input: any) => {
                    const humanPrompt = prompt_validateImplementedSuggestions({
                        codePatch: input.codePatch,
                        codeSuggestions: input.codeSuggestions,
                    });

                    return [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: humanPrompt,
                                },
                            ],
                        },
                    ];
                },
                llm,
                new StringOutputParser(),
            ]);

            return chain;
        } catch (error) {
            this.logger.error({
                message: `Error creating validate implemented suggestions chain for PR#${prNumber}`,
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData: organizationAndTeamData,
                    prNumber: prNumber,
                    provider,
                },
            });
        }
    }

    //#endregion

    //#region Select Review Mode
    async selectReviewMode(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        file: FileChange,
        codeDiff: string,
    ): Promise<ReviewModeResponse> {
        const baseContext = {
            organizationAndTeamData,
            prNumber,
            file,
            codeDiff,
        };

        const chain = await this.createSelectReviewModeChainWithFallback(
            organizationAndTeamData,
            prNumber,
            provider,
            baseContext,
        );

        try {
            const result = await chain.invoke(baseContext);

            const reviewMode =
                this.llmResponseProcessor.processReviewModeResponse(
                    organizationAndTeamData,
                    prNumber,
                    result,
                );

            return reviewMode?.reviewMode || ReviewModeResponse.LIGHT_MODE;
        } catch (error) {
            this.logger.error({
                message: 'Error executing select review mode chain:',
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    provider,
                },
            });
            return ReviewModeResponse.LIGHT_MODE;
        }
    }

    private async createSelectReviewModeChainWithFallback(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        context: any,
    ) {
        const fallbackProvider =
            provider === LLMModelProvider.OPENAI_GPT_4O
                ? LLMModelProvider.NOVITA_DEEPSEEK_V3_0324
                : LLMModelProvider.OPENAI_GPT_4O;

        try {
            // Main chain
            const mainChain = await this.createSelectReviewModeChain(
                organizationAndTeamData,
                prNumber,
                provider,
                context,
            );

            // Fallback chain
            const fallbackChain = await this.createSelectReviewModeChain(
                organizationAndTeamData,
                prNumber,
                fallbackProvider,
                context,
            );

            // Configure chain with fallback
            return mainChain
                .withFallbacks({
                    fallbacks: [fallbackChain],
                })
                .withConfig({
                    runName: 'selectReviewMode',
                    metadata: {
                        organizationId: organizationAndTeamData?.organizationId,
                        teamId: organizationAndTeamData?.teamId,
                        pullRequestId: prNumber,
                        provider: provider,
                        fallbackProvider: fallbackProvider,
                    },
                });
        } catch (error) {
            this.logger.error({
                message:
                    'Error creating select review mode chain with fallback',
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    provider,
                    fallbackProvider,
                    organizationAndTeamData,
                    prNumber,
                },
            });
            throw error;
        }
    }

    private async createSelectReviewModeChain(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        provider: LLMModelProvider,
        context: any,
    ) {
        try {
            let llm = this.llmProviderService.getLLMProvider({
                model: provider,
                temperature: 0,
                callbacks: [this.tokenTracker],
                jsonMode: true,
            });

            const chain = RunnableSequence.from([
                async (input: any) => {
                    const humanPrompt = prompt_selectorLightOrHeavyMode_system({
                        file: input.file,
                        codeDiff: input.codeDiff,
                    });

                    return [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: humanPrompt,
                                },
                            ],
                        },
                    ];
                },
                llm,
                new StringOutputParser(),
            ]);

            return chain;
        } catch (error) {
            this.logger.error({
                message: `Error creating select review mode chain for PR#${prNumber}`,
                error,
                context: LLMAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    provider,
                },
            });
        }
    }

    //#endregion
}
