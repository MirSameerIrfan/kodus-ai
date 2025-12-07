import { Injectable } from '@nestjs/common';
import { createLogger } from '@kodus/flow';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import {
    serializeContext,
    deserializeContext,
} from '../context/code-review-pipeline.context';
import { WorkflowJobRepository } from '@core/database/typeorm/repositories/workflow-job.repository';
import {
    StateSerializerService,
    SerializationStrategy,
} from './state-serializer.service';

/**
 * PipelineStateManager
 * Manages persistence and resumption of pipeline state
 */
@Injectable()
export class PipelineStateManager {
    private readonly logger = createLogger(PipelineStateManager.name);
    private readonly previousStates = new Map<
        string,
        CodeReviewPipelineContext
    >(); // Cache de estados anteriores para delta

    constructor(
        private readonly jobRepository: WorkflowJobRepository,
        private readonly serializer: StateSerializerService,
    ) {}

    /**
     * Save pipeline state to WorkflowJob.pipelineState
     * @param workflowJobId - ID do workflow job
     * @param context - Contexto do pipeline
     * @param strategy - Estratégia de serialização (default: 'full')
     */
    async saveState(
        workflowJobId: string,
        context: CodeReviewPipelineContext,
        strategy: SerializationStrategy = 'full',
    ): Promise<void> {
        try {
            // Obter estado anterior do cache para delta
            const previousState = this.previousStates.get(workflowJobId);

            // Serializar usando estratégia escolhida
            const stateObject = await this.serializer.serialize(context, {
                strategy,
                previousState,
            });

            await this.jobRepository.updatePipelineState(
                workflowJobId,
                stateObject,
            );

            // Atualizar cache do estado anterior
            this.previousStates.set(workflowJobId, { ...context });

            // Log com informações de tamanho (se comprimido)
            const sizeInfo =
                strategy === 'compressed' && stateObject.compressedSize
                    ? {
                          originalSize: stateObject.size,
                          compressedSize: stateObject.compressedSize,
                          compressionRatio: (
                              (1 -
                                  stateObject.compressedSize /
                                      stateObject.size) *
                              100
                          ).toFixed(1),
                      }
                    : {};

            this.logger.debug({
                message: `Pipeline state saved for workflow job`,
                context: PipelineStateManager.name,
                metadata: {
                    workflowJobId,
                    currentStage: context.currentStage,
                    correlationId: context.correlationId,
                    strategy,
                    ...sizeInfo,
                },
            });
        } catch (error) {
            this.logger.error({
                message: `Failed to save pipeline state`,
                context: PipelineStateManager.name,
                error: error instanceof Error ? error : undefined,
                metadata: {
                    workflowJobId,
                    correlationId: context.correlationId,
                    strategy,
                },
            });
            throw error;
        }
    }

    /**
     * Load and deserialize pipeline state from WorkflowJob.pipelineState
     */
    async resumeFromState(
        workflowJobId: string,
    ): Promise<CodeReviewPipelineContext | null> {
        try {
            const job = await this.jobRepository.findOne(workflowJobId);
            if (!job) {
                this.logger.warn({
                    message: `Workflow job not found`,
                    context: PipelineStateManager.name,
                    metadata: {
                        workflowJobId,
                    },
                });
                return null;
            }

            if (!job.pipelineState) {
                this.logger.warn({
                    message: `No pipeline state found for workflow job`,
                    context: PipelineStateManager.name,
                    metadata: {
                        workflowJobId,
                    },
                });
                return null;
            }

            // Deserializar usando serializer (detecta automaticamente estratégia)
            let deserializedContext: CodeReviewPipelineContext;

            try {
                deserializedContext = await this.serializer.deserialize(
                    job.pipelineState,
                );
            } catch (error) {
                // Fallback para deserialização antiga (compatibilidade)
                this.logger.warn({
                    message: `Failed to deserialize with serializer, falling back to legacy method`,
                    context: PipelineStateManager.name,
                    error: error instanceof Error ? error : undefined,
                    metadata: { workflowJobId },
                });

                deserializedContext = deserializeContext(
                    JSON.stringify(job.pipelineState),
                );
            }

            this.logger.log({
                message: `Pipeline state loaded for workflow job`,
                context: PipelineStateManager.name,
                metadata: {
                    workflowJobId,
                    currentStage: deserializedContext.currentStage,
                    correlationId: deserializedContext.correlationId,
                },
            });

            return deserializedContext;
        } catch (error) {
            this.logger.error({
                message: `Failed to resume pipeline state`,
                context: PipelineStateManager.name,
                error: error instanceof Error ? error : undefined,
                metadata: {
                    workflowJobId,
                },
            });
            throw error;
        }
    }

    /**
     * Get current state without deserializing
     */
    async getState(
        workflowJobId: string,
    ): Promise<Record<string, unknown> | null> {
        try {
            const job = await this.jobRepository.findOne(workflowJobId);
            if (!job || !job.pipelineState) {
                return null;
            }

            return job.pipelineState;
        } catch (error) {
            this.logger.error({
                message: `Failed to get pipeline state`,
                context: PipelineStateManager.name,
                error: error instanceof Error ? error : undefined,
                metadata: {
                    workflowJobId,
                },
            });
            throw error;
        }
    }
}

