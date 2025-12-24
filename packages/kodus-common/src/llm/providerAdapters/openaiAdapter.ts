import { ChatOpenAI } from '@langchain/openai';
import { resolveModelOptions } from './resolver';
import { supportsJsonMode } from './capabilities';
import { AdapterBuildParams, ProviderAdapter } from './types';

export class OpenAIAdapter implements ProviderAdapter {
    build(params: AdapterBuildParams): ChatOpenAI {
        const { model, apiKey, baseURL, options } = params;
        const resolved = resolveModelOptions(model, {
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
            maxReasoningTokens: options?.maxReasoningTokens,
        });

        const reasoningEffort =
            resolved.supportsReasoning &&
            resolved.reasoningType === 'level' &&
            resolved.resolvedReasoningLevel
                ? resolved.resolvedReasoningLevel
                : undefined;

        const payload: ConstructorParameters<typeof ChatOpenAI>[0] = {
            model,
            apiKey,
            ...(resolved.resolvedMaxTokens
                ? { maxTokens: resolved.resolvedMaxTokens }
                : {}),
            ...(resolved.temperature !== undefined
                ? { temperature: resolved.temperature }
                : {}),
            ...(reasoningEffort
                ? {
                      reasoning: { effort: reasoningEffort },
                      reasoningEffort,
                  }
                : {}),
            ...(resolved.supportsReasoning && resolved.reasoningType === 'level'
                ? { useResponsesApi: true }
                : {}),
            ...(options?.jsonMode && supportsJsonMode(model)
                ? {
                      response_format: { type: 'json_object' as const },
                  }
                : {}),
            callbacks: options?.callbacks,
            configuration: {
                ...(baseURL ? { baseURL } : {}),
            },
        };

        return new ChatOpenAI(payload);
    }
}
