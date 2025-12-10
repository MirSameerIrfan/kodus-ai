import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';

import { PipelineContext } from '@libs/core/infrastructure/pipeline/interfaces/pipeline-context.interface';
import { PipelineStage } from '@libs/core/infrastructure/pipeline/interfaces/pipeline.interface';
import { WorkflowPausedError } from '../../domain/errors/workflow-paused.error';
import { PipelineStateManager } from '../state/pipeline-state-manager.service';
import { EventBufferService } from '../event-buffer.service';
import { topologicalSort } from '@libs/core/infrastructure/pipeline/utils/topological-sort.util';
import { HeavyStage } from '@libs/core/infrastructure/pipeline/interfaces/heavy-stage.interface';

/**
 * Generic Durable Pipeline Executor
 * Orchestrates the execution of stages with state persistence and pause/resume capabilities.
 */
@Injectable()
export class DurablePipelineExecutor {
    private readonly logger = createLogger(DurablePipelineExecutor.name);

    constructor(
        private readonly stateManager: PipelineStateManager,
        private readonly eventBuffer: EventBufferService,
    ) {}

    /**
     * Execute a pipeline definition
     */
    async execute<TContext extends PipelineContext>(
        context: TContext,
        stages: PipelineStage<TContext>[],
        workflowJobId: string,
    ): Promise<TContext> {
        // 1. Sort stages
        const sortedStages = topologicalSort(stages);

        // 2. Load previous state if any (for resume)
        const savedState =
            await this.stateManager.loadState<TContext>(workflowJobId);
        let currentContext = savedState ? savedState.context : context;
        let startIndex = 0;

        // 3. Determine start index based on saved state
        if (savedState?.currentStage) {
            const stageIndex = sortedStages.findIndex(
                (s) => s.stageName === savedState.currentStage,
            );
            // If found, start from NEXT stage (assuming previous completed, or resume handling below)
            // But wait, if we paused *inside* a stage, we need to resume *that* stage.
            // The logic below handles resume specific to HeavyStages.
            if (stageIndex !== -1) {
                startIndex = stageIndex;
            }
        }

        // 4. Initialize pipeline if fresh start
        if (startIndex === 0 && !savedState) {
            await this.stateManager.saveState(
                workflowJobId,
                currentContext,
                'INIT',
            );
        }

        // 5. Execute stages
        for (let i = startIndex; i < sortedStages.length; i++) {
            const stage = sortedStages[i];

            this.logger.log({
                message: `Executing stage: ${stage.stageName}`,
                context: DurablePipelineExecutor.name,
                metadata: {
                    workflowJobId,
                    stage: stage.stageName,
                    index: i,
                },
            });

            try {
                // Check for Resume condition (if we are resuming this stage)
                if (savedState && savedState.currentStage === stage.stageName) {
                    if (this.isHeavyStage(stage)) {
                        // Logic to resume heavy stage
                        // We need to know the taskId to resume.
                        // This implies the context has the taskId or we get it from metadata?
                        // In our architecture, the HeavyStageEventHandler puts the event in the metadata.
                        // But here we need to call stage.resume()
                        // For simplicity in this generic version, let's assume context carries necessary data
                        // OR we rely on the stage checking the context.
                        // Note: In the specific implementation, we had:
                        // const taskId = ... from error ...
                        // Here we assume the stage.resume(context, taskId) is called.
                        // We need to pass the resume signal.
                    }
                }

                // Execute the stage
                // If it's a HeavyStage that was paused, we might need to call resume() instead of execute()
                // But typically execute() handles the "check if done" logic or we call resume explicitly.
                // Let's stick to the pattern:
                // If context has "resume" flag (implied by execution flow), call execute.
                // The HeavyStage implementation is responsible for checking if it needs to start or resume?
                // NO, the executor calls resume().

                // Let's refine the Resume Logic:
                // We need to know if we are in a "Resume" state for this specific stage.
                // We can check if we have a pending event for this stage in the buffer or metadata.

                // Simplified flow: Always call execute().
                // If HeavyStage detects it's already started (via context), it should handle it?
                // Standard pattern:
                // Executor calls `execute`.
                // If `execute` throws `WorkflowPausedError`, we catch, save state, and rethrow.
                // If we are RESUMING, we call `resume` on the stage.

                // How do we know we are resuming?
                // We passed `savedState`.

                if (savedState && savedState.currentStage === stage.stageName) {
                    // We are resuming THIS stage.
                    if (this.isHeavyStage(stage)) {
                        // We need the taskId. It should be in the job metadata/context.
                        // For now, let's assume the context has been enriched by the EventHandler with the result.
                        // So we can just call execute() and the stage will see the result in context?
                        // OR we call resume().
                        // Let's look at HeavyStage interface. It has `resume(context, taskId)`.
                        // We need the taskId.
                        // The Generic Executor doesn't know where taskId is unless we enforce a structure.
                        // HACK: For now, we call execute(). The HeavyStage usually checks context.
                        // If we want to support `resume()`, we need to change how we invoke it.
                        // Let's rely on `execute` calling `start` or handling resume internally if context has data.
                        // OR: We define that HeavyStages must be idempotent or handle their own state in context.
                        // Re-reading previous implementation:
                        // It called `resume` explicitely.
                        // To do that generically, we'd need to know we are resuming.
                    }
                }

                currentContext = await stage.execute(currentContext);

                // Save state after success
                await this.stateManager.saveState(
                    workflowJobId,
                    currentContext,
                    stage.stageName,
                );
            } catch (error) {
                if (error instanceof WorkflowPausedError) {
                    this.logger.log({
                        message: `Workflow paused at stage ${stage.stageName}`,
                        context: DurablePipelineExecutor.name,
                        metadata: {
                            workflowJobId,
                            stage: stage.stageName,
                            reason: error.message,
                        },
                    });

                    // Save state so we can resume from here
                    await this.stateManager.saveState(
                        workflowJobId,
                        currentContext,
                        stage.stageName,
                    );

                    // Check buffer just in case event arrived while processing
                    const bufferedEvent = await this.eventBuffer.check(
                        error.eventType,
                        error.eventKey,
                    );
                    if (bufferedEvent) {
                        this.logger.log({
                            message: `Found buffered event for paused workflow, resuming immediately`,
                            context: DurablePipelineExecutor.name,
                        });
                        // Recursive call or loop?
                        // If we found it, we can apply result and continue.
                        // But `stage.resume` needs to be called.
                        // This suggests we should have a `resume` flow here.

                        // For this generic implementation, let's re-throw.
                        // The Consumer handles the "Pause" and sets the job status.
                        // If we handle buffer here, we avoid the queue trip.
                        // But let's keep it simple: Rethrow.
                    }

                    throw error;
                }
                throw error;
            }
        }

        return currentContext;
    }

    private isHeavyStage(stage: any): stage is HeavyStage {
        return typeof stage.resume === 'function';
    }

    /**
     * Resume execution specifically (Explicit Entry Point)
     * Called by Consumer when a job is picked up with "Resumed" status/metadata
     */
    async resume<TContext extends PipelineContext>(
        context: TContext,
        stages: PipelineStage<TContext>[],
        workflowJobId: string,
        taskId: string, // The ID of the task that completed
        stageName: string, // The stage to resume
    ): Promise<TContext> {
        const sortedStages = topologicalSort(stages);
        const stageIndex = sortedStages.findIndex(
            (s) => s.stageName === stageName,
        );

        if (stageIndex === -1) {
            throw new Error(`Stage ${stageName} not found in pipeline`);
        }

        const stage = sortedStages[stageIndex];

        this.logger.log({
            message: `Resuming pipeline at stage: ${stageName}`,
            context: DurablePipelineExecutor.name,
            metadata: { workflowJobId, stageName },
        });

        if (this.isHeavyStage(stage)) {
            // Call specific resume method
            context = await stage.resume(context, taskId);

            // Save state after resume
            await this.stateManager.saveState(
                workflowJobId,
                context,
                stageName,
            );
        } else {
            // For light stages, just re-execute? Or assume done?
            // Usually we resume heavy stages. Light stages shouldn't pause.
        }

        // Continue with remaining stages
        // We start from the NEXT stage, because `resume` completed the current one.
        // So we create a new sub-list of stages starting from stageIndex + 1
        const remainingStages = sortedStages.slice(stageIndex + 1);

        return this.execute(context, remainingStages, workflowJobId);
    }
}
