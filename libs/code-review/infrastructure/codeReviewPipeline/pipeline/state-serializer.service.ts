import { promisify } from 'util';
import * as zlib from 'zlib';

import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';

import { CodeReviewPipelineContext } from '../../context/code-review-pipeline.context';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export type SerializationStrategy = 'full' | 'delta' | 'minimal' | 'compressed';

export interface SerializationOptions {
    strategy: SerializationStrategy;
    previousState?: CodeReviewPipelineContext;
}

@Injectable()
export class StateSerializerService {
    private readonly logger = createLogger(StateSerializerService.name);

    /**
     * Serializa estado com estratégia configurável
     */
    async serialize(
        context: CodeReviewPipelineContext,
        options: SerializationOptions = { strategy: 'full' },
    ): Promise<Record<string, unknown>> {
        switch (options.strategy) {
            case 'delta':
                return this.serializeDelta(context, options.previousState);
            case 'minimal':
                return this.serializeMinimal(context);
            case 'compressed':
                return await this.serializeCompressed(context);
            case 'full':
            default:
                return this.serializeFull(context);
        }
    }

    /**
     * Deserializa estado (detecta automaticamente se está comprimido)
     */
    async deserialize(
        data: Record<string, unknown>,
    ): Promise<CodeReviewPipelineContext> {
        // Verificar se está comprimido
        if (data.compressed && typeof data.data === 'string') {
            return await this.deserializeCompressed(data);
        }

        // Deserializar como JSON normal
        return data as unknown as CodeReviewPipelineContext;
    }

    /**
     * Serialização completa (atual - padrão)
     */
    private serializeFull(
        context: CodeReviewPipelineContext,
    ): Record<string, unknown> {
        return JSON.parse(JSON.stringify(context));
    }

    /**
     * Serialização incremental (apenas mudanças)
     * Compara com estado anterior e salva apenas diferenças significativas
     */
    private serializeDelta(
        currentState: CodeReviewPipelineContext,
        previousState?: CodeReviewPipelineContext,
    ): Record<string, unknown> {
        if (!previousState) {
            // Primeiro checkpoint - salvar tudo
            return this.serializeFull(currentState);
        }

        const delta: Record<string, unknown> = {
            workflowJobId: currentState.workflowJobId,
            currentStage: currentState.currentStage,
            correlationId: currentState.correlationId,
            automationExecutionId: currentState.automationExecutionId,
            updatedAt: Date.now(),
            _strategy: 'delta',
        };

        // Comparar e adicionar apenas mudanças significativas
        const significantFields: (keyof CodeReviewPipelineContext)[] = [
            'validSuggestions',
            'discardedSuggestions',
            'fileMetadata',
            'prAnalysisResults',
            'changedFiles',
            'statusInfo',
            'tasks',
            'initialCommentData',
        ];

        for (const field of significantFields) {
            const currentValue = currentState[field];
            const previousValue = previousState[field];

            if (
                JSON.stringify(currentValue) !== JSON.stringify(previousValue)
            ) {
                delta[field] = currentValue;
            }
        }

        // Sempre incluir metadados essenciais
        delta.organizationAndTeamData = {
            organizationId:
                currentState.organizationAndTeamData?.organizationId,
            teamId: currentState.organizationAndTeamData?.teamId,
        };

        delta.repository = {
            id: currentState.repository?.id,
            name: currentState.repository?.name,
        };

        delta.pullRequest = {
            number: currentState.pullRequest?.number,
        };

        return delta;
    }

    /**
     * Serialização mínima (apenas IDs e referências essenciais)
     * Útil para checkpoints intermediários onde não precisamos do estado completo
     */
    private serializeMinimal(
        context: CodeReviewPipelineContext,
    ): Record<string, unknown> {
        return {
            workflowJobId: context.workflowJobId,
            currentStage: context.currentStage,
            correlationId: context.correlationId,
            automationExecutionId: context.automationExecutionId,
            _strategy: 'minimal',

            // Apenas IDs, não objetos completos
            organizationId: context.organizationAndTeamData?.organizationId,
            teamId: context.organizationAndTeamData?.teamId,
            repositoryId: context.repository?.id,
            pullRequestNumber: context.pullRequest?.number,

            // Metadados mínimos
            validSuggestionsCount: context.validSuggestions?.length || 0,
            changedFilesCount: context.changedFiles?.length || 0,
            status: context.statusInfo?.status,
            message: context.statusInfo?.message,
        };
    }

    /**
     * Serialização comprimida
     * Comprime o estado completo antes de salvar
     */
    private async serializeCompressed(
        context: CodeReviewPipelineContext,
    ): Promise<Record<string, unknown>> {
        const serialized = JSON.stringify(context);
        const compressed = await gzip(Buffer.from(serialized));

        return {
            compressed: true,
            _strategy: 'compressed',
            data: compressed.toString('base64'),
            size: serialized.length, // Tamanho original para referência
            compressedSize: compressed.length, // Tamanho comprimido
        };
    }

    /**
     * Deserializa estado comprimido
     */
    private async deserializeCompressed(
        data: Record<string, unknown>,
    ): Promise<CodeReviewPipelineContext> {
        if (!data.compressed || typeof data.data !== 'string') {
            throw new Error('Invalid compressed state format');
        }

        try {
            const decompressed = await gunzip(Buffer.from(data.data, 'base64'));
            return JSON.parse(
                decompressed.toString(),
            ) as CodeReviewPipelineContext;
        } catch (error) {
            this.logger.error({
                message: 'Failed to decompress pipeline state',
                context: StateSerializerService.name,
                error: error instanceof Error ? error : undefined,
            });
            throw error;
        }
    }

    /**
     * Aplicar delta ao estado anterior para reconstruir estado completo
     */
    applyDelta(
        baseState: CodeReviewPipelineContext,
        delta: Record<string, unknown>,
    ): CodeReviewPipelineContext {
        if (delta._strategy !== 'delta') {
            return delta as unknown as CodeReviewPipelineContext;
        }

        // Aplicar mudanças do delta ao estado base
        const reconstructed = { ...baseState };

        for (const [key, value] of Object.entries(delta)) {
            if (key !== '_strategy' && key !== 'updatedAt') {
                (reconstructed as any)[key] = value;
            }
        }

        return reconstructed;
    }
}
