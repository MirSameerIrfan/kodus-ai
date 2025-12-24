import {
    LangChainLLM,
    LangChainMessage,
    LangChainOptions,
    LangChainResponse,
    LLMMessage,
    LLMResponse,
} from '../../../core/types/allTypes.js';
import { createLogger } from '../../../observability/index.js';
import { EngineError } from '../../errors.js';
import { normalizeLLMContent } from '../normalizers.js';

type OpenAIToolDefinition = {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
    };
};

type ToolCallLike = {
    id?: string;
    type?: string;
    name?: string;
    args?: unknown;
    function?: {
        name?: string;
        arguments?: string;
    };
};

// Simple provider interface for legacy providers
export interface LLMProvider {
    name: string;
    call(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
    stream?(
        messages: LLMMessage[],
        options?: LLMOptions,
    ): AsyncGenerator<LLMResponse>;
}

export interface LLMOptions {
    temperature?: number;
    maxTokens?: number;
    model?: string;
    topP?: number;
    stop?: string[];
    frequencyPenalty?: number;
    presencePenalty?: number;
    stream?: boolean;
    tools?: Array<{
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    }>;
    toolChoice?:
        | 'auto'
        | 'none'
        | { type: 'function'; function: { name: string } };
}

// ──────────────────────────────────────────────────────────────────────────────
// 🚀 LANGCHAIN PROVIDER IMPLEMENTATION
// ──────────────────────────────────────────────────────────────────────────────

export class LangChainProvider implements LLMProvider {
    public readonly name: string;
    private llm: LangChainLLM;
    private logger = createLogger('langchain-provider');

    constructor(llm: LangChainLLM) {
        this.llm = llm;
        this.name = llm.name || 'langchain-llm';
        this.logger.log({
            message: 'LangChain provider initialized',
            context: this.constructor.name,

            metadata: {
                name: this.name,
            },
        });
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // 🎯 MAIN INTERFACE
    // ──────────────────────────────────────────────────────────────────────────────

    async call(
        messages: LLMMessage[],
        options?: LLMOptions,
    ): Promise<LLMResponse> {
        try {
            // Convert our format to LangChain format
            const langchainMessages = this.convertToLangChainMessages(messages);
            const langchainOptions = this.convertToLangChainOptions(options);

            this.logger.debug({
                message: 'Calling LangChain LLM',
                context: this.constructor.name,

                metadata: {
                    messageCount: messages.length,
                    options: langchainOptions,
                },
            });

            // Call the LangChain LLM
            const response = await this.invokeLLM(
                langchainMessages,
                langchainOptions,
            );

            // Convert response back to our format
            const convertedResponse =
                this.convertFromLangChainResponse(response);

            this.logger.debug({
                message: 'LangChain LLM response received',
                context: this.constructor.name,

                metadata: {
                    hasContent: !!convertedResponse.content,
                    hasToolCalls: !!convertedResponse.toolCalls?.length,
                    usage: convertedResponse.usage,
                },
            });

            return convertedResponse;
        } catch (error) {
            this.logger.error({
                message: 'LangChain LLM call failed',
                context: this.constructor.name,
                error:
                    error instanceof Error ? error : new Error('Unknown error'),
            });
            throw new EngineError(
                'LLM_ERROR',
                `LangChain call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    async *stream(
        messages: LLMMessage[],
        options?: LLMOptions,
    ): AsyncGenerator<LLMResponse> {
        try {
            const langchainMessages = this.convertToLangChainMessages(messages);
            const langchainOptions = this.convertToLangChainOptions(options);

            this.logger.debug({
                message: 'Starting LangChain LLM stream',
                context: this.constructor.name,

                metadata: {
                    messageCount: messages.length,
                    options: langchainOptions,
                },
            });

            const stream = this.streamLLM(langchainMessages, langchainOptions);

            for await (const chunk of stream) {
                const convertedChunk = this.convertFromLangChainResponse(chunk);
                yield convertedChunk;
            }
        } catch (error) {
            this.logger.error({
                message: 'LangChain LLM streaming failed',
                context: this.constructor.name,
                error:
                    error instanceof Error ? error : new Error('Unknown error'),
            });
            throw new EngineError(
                'LLM_ERROR',
                `LangChain streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // 🔄 FORMAT CONVERSION
    // ──────────────────────────────────────────────────────────────────────────────

    private convertToLangChainMessages(
        messages: LLMMessage[],
    ): LangChainMessage[] {
        return messages.map((msg) => {
            const base: Record<string, unknown> = {
                role: msg.role,
                content: msg.content,
                name: msg.name,
            };
            if (msg.toolCalls) {
                base['tool_calls'] = msg.toolCalls;
            }
            if (msg.toolCallId) {
                base['tool_call_id'] = msg.toolCallId;
            }
            return base as LangChainMessage;
        });
    }

    private convertToLangChainOptions(options?: LLMOptions): LangChainOptions {
        if (!options) return {};

        const tools: OpenAIToolDefinition[] | undefined = options.tools?.length
            ? options.tools.map((tool) => ({
                  type: 'function',
                  function: {
                      name: tool.name,
                      description: tool.description,
                      parameters: tool.parameters,
                  },
              }))
            : undefined;

        const payload: LangChainOptions = {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            frequencyPenalty: options.frequencyPenalty,
            presencePenalty: options.presencePenalty,
            stop: options.stop,
            stream: options.stream,
            tools,
        };
        const toolChoice =
            typeof options.toolChoice === 'string'
                ? options.toolChoice
                : options.toolChoice;
        if (toolChoice) {
            (payload as Record<string, unknown>)['tool_choice'] = toolChoice;
        }
        return payload;
    }

    private convertFromLangChainResponse(
        response: LangChainResponse | string | unknown,
    ): LLMResponse {
        if (typeof response === 'string') {
            return { content: response };
        }

        const content = normalizeLLMContent(response);
        const toolCalls = this.extractToolCalls(response);
        const usage = this.extractUsage(response);

        return {
            content,
            toolCalls,
            usage,
        };
    }

    private async invokeLLM(
        messages: LangChainMessage[],
        options?: LangChainOptions,
    ): Promise<LangChainResponse | string | unknown> {
        if (typeof this.llm.invoke === 'function') {
            return this.llm.invoke(messages, options);
        }
        if (typeof this.llm.call === 'function') {
            return this.llm.call(messages, options);
        }
        throw new Error('LangChain LLM does not implement invoke or call');
    }

    private streamLLM(
        messages: LangChainMessage[],
        options?: LangChainOptions,
    ): AsyncGenerator<LangChainResponse | string | unknown> {
        if (!this.llm.stream) {
            throw new EngineError(
                'LLM_ERROR',
                'Streaming not supported by this LangChain LLM',
            );
        }
        return this.llm.stream(messages, options);
    }

    private extractToolCalls(
        response: unknown,
    ): LLMResponse['toolCalls'] | undefined {
        if (!response || typeof response !== 'object') return undefined;
        const record = response as Record<string, unknown>;
        const raw =
            record['tool_calls'] ??
            (record as { toolCalls?: unknown }).toolCalls ??
            (
                record['additional_kwargs'] as
                    | Record<string, unknown>
                    | undefined
            )?.['tool_calls'] ??
            (
                record['additionalKwargs'] as
                    | Record<string, unknown>
                    | undefined
            )?.['tool_calls'];

        if (!Array.isArray(raw)) return undefined;

        type ParsedToolCall = NonNullable<LLMResponse['toolCalls']>[number];
        const parsed = raw
            .map((call) => {
                if (!call || typeof call !== 'object') return undefined;
                const typed = call as ToolCallLike;
                const name = typed.name ?? typed.function?.name;
                const args = typed.args ?? typed.function?.arguments;
                if (!name) return undefined;

                if (typeof args === 'string') {
                    try {
                        return {
                            name,
                            arguments: JSON.parse(args) as Record<
                                string,
                                unknown
                            >,
                        };
                    } catch {
                        return { name, arguments: {} };
                    }
                }

                if (args && typeof args === 'object') {
                    return {
                        name,
                        arguments: args as Record<string, unknown>,
                    };
                }

                return { name, arguments: {} };
            })
            .filter((call): call is ParsedToolCall => Boolean(call));

        return parsed.length ? parsed : undefined;
    }

    private extractUsage(response: unknown): LLMResponse['usage'] | undefined {
        if (!response || typeof response !== 'object') {
            return undefined;
        }
        const record = response as Record<string, unknown>;
        const usageMetadata = record['usage_metadata'];
        const responseMetadata = record['response_metadata'];
        const legacyUsage = (record as { usage?: unknown }).usage;
        const additionalUsage = (
            record as { additionalKwargs?: { usage?: unknown } }
        ).additionalKwargs?.usage;

        if (usageMetadata && typeof usageMetadata === 'object') {
            const meta = usageMetadata as Record<string, unknown>;
            const inputTokens =
                typeof meta['input_tokens'] === 'number'
                    ? meta['input_tokens']
                    : undefined;
            const outputTokens =
                typeof meta['output_tokens'] === 'number'
                    ? meta['output_tokens']
                    : undefined;
            const totalTokens =
                typeof meta['total_tokens'] === 'number'
                    ? meta['total_tokens']
                    : undefined;
            return {
                promptTokens: inputTokens ?? 0,
                completionTokens: outputTokens ?? 0,
                totalTokens:
                    totalTokens ?? (inputTokens ?? 0) + (outputTokens ?? 0),
            };
        }

        if (responseMetadata && typeof responseMetadata === 'object') {
            const meta = responseMetadata as {
                tokenUsage?: {
                    promptTokens?: number;
                    completionTokens?: number;
                    totalTokens?: number;
                };
                usage?: Record<string, unknown>;
            };
            if (meta.tokenUsage) {
                return {
                    promptTokens: meta.tokenUsage.promptTokens ?? 0,
                    completionTokens: meta.tokenUsage.completionTokens ?? 0,
                    totalTokens: meta.tokenUsage.totalTokens ?? 0,
                };
            }
            if (meta.usage) {
                const inputTokens =
                    typeof meta.usage['input_tokens'] === 'number'
                        ? meta.usage['input_tokens']
                        : undefined;
                const outputTokens =
                    typeof meta.usage['output_tokens'] === 'number'
                        ? meta.usage['output_tokens']
                        : undefined;
                const totalTokens =
                    typeof meta.usage['total_tokens'] === 'number'
                        ? meta.usage['total_tokens']
                        : undefined;
                return {
                    promptTokens: inputTokens ?? 0,
                    completionTokens: outputTokens ?? 0,
                    totalTokens:
                        totalTokens ?? (inputTokens ?? 0) + (outputTokens ?? 0),
                };
            }
        }

        const finalUsage =
            legacyUsage && typeof legacyUsage === 'object'
                ? legacyUsage
                : additionalUsage && typeof additionalUsage === 'object'
                  ? additionalUsage
                  : undefined;

        if (finalUsage) {
            const u = finalUsage as {
                promptTokens?: number;
                completionTokens?: number;
                totalTokens?: number;
            };
            return {
                promptTokens: u.promptTokens ?? 0,
                completionTokens: u.completionTokens ?? 0,
                totalTokens: u.totalTokens ?? 0,
            };
        }

        return undefined;
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // 🔧 UTILITY METHODS
    // ──────────────────────────────────────────────────────────────────────────────

    getLLM(): LangChainLLM {
        return this.llm;
    }

    setLLM(llm: LangChainLLM): void {
        this.llm = llm;
        this.logger.log({
            message: 'LangChain LLM updated',
            context: this.constructor.name,

            metadata: {
                name: llm.name,
            },
        });
    }

    supportsStreaming(): boolean {
        return typeof this.llm.stream === 'function';
    }

    supportsToolCalling(): boolean {
        // Most modern LangChain LLMs support tool calling
        // This is a heuristic check
        return true;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// 🏭 FACTORY FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

export function createLangChainProvider(llm: LangChainLLM): LangChainProvider {
    return new LangChainProvider(llm);
}

// ──────────────────────────────────────────────────────────────────────────────
// 🎯 HELPER FUNCTIONS FOR COMMON LANGCHAIN LLMS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create provider for OpenAI via LangChain
 */
export function createOpenAIProvider(
    openaiLLM: LangChainLLM,
): LangChainProvider {
    return new LangChainProvider(openaiLLM);
}

/**
 * Create provider for Anthropic via LangChain
 */
export function createAnthropicProvider(
    anthropicLLM: LangChainLLM,
): LangChainProvider {
    return new LangChainProvider(anthropicLLM);
}

/**
 * Create provider for any LangChain LLM
 */
export function createGenericLangChainProvider(
    llm: LangChainLLM,
): LangChainProvider {
    return new LangChainProvider(llm);
}
