import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';
import { CodeReviewPipelineContext } from '../context/code-review-pipeline.context';
import { Stage } from '../stages/base/stage.interface';
import { HeavyStage } from '../stages/base/heavy-stage.interface';
import { WorkflowPausedError } from '@libs/workflow-queue/domain/errors/workflow-paused.error';
import { AutomationStatus } from '@libs/automation/domain/enums/automation-status';
import { PipelineStateManager } from './pipeline-state-manager.service';
import { ObservabilityService } from '@shared/logging/observability.service';

/**
 * PipelineExecutor for CodeReviewPipeline
 * Orchestrates stage execution with state persistence and retry/compensation support
 */
@Injectable()
export class CodeReviewPipelineExecutor {
    private readonly logger = createLogger(CodeReviewPipelineExecutor.name);

    constructor(
        private readonly stateManager?: PipelineStateManager,
        private readonly observability?: ObservabilityService,
    ) {}

    /**
     * Execute pipeline stages sequentially
     * Persists state after each stage and handles heavy stages (pausing workflow)
     */
    async execute(
        context: CodeReviewPipelineContext,
        stages: Stage[],
        workflowJobId?: string,
    ): Promise<CodeReviewPipelineContext> {
        // Set workflowJobId in context if provided
        if (workflowJobId) {
            context.workflowJobId = workflowJobId;
        }

        // Persist initial state
        if (this.stateManager && workflowJobId) {
            await this.stateManager.saveState(workflowJobId, context);
        }

        // Execute pipeline with observability span
        if (this.observability) {
            return await this.observability.runInSpan(
                'pipeline.executor.execute',
                async (span) => {
                    span.setAttributes({
                        'pipeline.workflow_job.id': workflowJobId || '',
                        'pipeline.stages.count': stages.length,
                        'pipeline.correlation.id': context.correlationId || '',
                    });

                    return await this.executePipelineInternal(
                        context,
                        stages,
                        workflowJobId,
                    );
                },
                {
                    'workflow.component': 'pipeline_executor',
                    'workflow.operation': 'execute_pipeline',
                },
            );
        }

        // Fallback if observability is not available
        return await this.executePipelineInternal(
            context,
            stages,
            workflowJobId,
        );
    }

    /**
     * Internal pipeline execution logic
     */
    private async executePipelineInternal(
        context: CodeReviewPipelineContext,
        stages: Stage[],
        workflowJobId?: string,
    ): Promise<CodeReviewPipelineContext> {
        this.logger.log({
            message: `Starting pipeline execution`,
            context: CodeReviewPipelineExecutor.name,
            metadata: {
                workflowJobId,
                stagesCount: stages.length,
                correlationId: context.correlationId,
            },
        });

        // Build execution order based on dependencies
        const executionOrder = this.buildExecutionOrder(stages);

        // Execute stages in order
        for (const stageName of executionOrder) {
            const stage = stages.find((s) => s.name === stageName);
            if (!stage) {
                throw new Error(`Stage '${stageName}' not found`);
            }

            // Check if stage can execute
            if (stage.canExecute && !(await stage.canExecute(context))) {
                this.logger.log({
                    message: `Stage '${stageName}' skipped (canExecute returned false)`,
                    context: CodeReviewPipelineExecutor.name,
                    metadata: {
                        workflowJobId,
                        stageName,
                        correlationId: context.correlationId,
                    },
                });
                continue;
            }

            // Update current stage in context
            context.currentStage = stageName;

            // Persist state before executing stage
            if (this.stateManager && workflowJobId) {
                await this.stateManager.saveState(workflowJobId, context);
            }

            // Execute stage with observability span
            try {
                if (this.observability) {
                    context = await this.observability.runInSpan(
                        `pipeline.stage.${stageName}`,
                        async (span) => {
                            span.setAttributes({
                                'pipeline.stage.name': stageName,
                                'pipeline.stage.type': stage.isLight()
                                    ? 'light'
                                    : 'heavy',
                                'pipeline.workflow_job.id': workflowJobId || '',
                                'pipeline.correlation.id':
                                    context.correlationId || '',
                            });

                            return await this.executeStage(
                                stage,
                                context,
                                workflowJobId,
                            );
                        },
                        {
                            'workflow.component': 'pipeline_stage',
                            'workflow.operation': 'execute_stage',
                        },
                    );
                } else {
                    context = await this.executeStage(
                        stage,
                        context,
                        workflowJobId,
                    );
                }

                // Persist state after successful stage execution
                if (this.stateManager && workflowJobId) {
                    await this.stateManager.saveState(workflowJobId, context);
                }

                this.logger.log({
                    message: `Stage '${stageName}' completed successfully`,
                    context: CodeReviewPipelineExecutor.name,
                    metadata: {
                        workflowJobId,
                        stageName,
                        correlationId: context.correlationId,
                    },
                });
            } catch (error) {
                // If error is WorkflowPausedError, propagate it (don't treat as failure)
                if (error instanceof WorkflowPausedError) {
                    this.logger.log({
                        message: `Stage '${stageName}' paused workflow waiting for event`,
                        context: CodeReviewPipelineExecutor.name,
                        metadata: {
                            workflowJobId,
                            stageName,
                            eventType: error.eventType,
                            eventKey: error.eventKey,
                            taskId: error.taskId,
                            timeout: error.timeout,
                            correlationId: context.correlationId,
                        },
                    });
                    // Persist state before pausing
                    if (this.stateManager && workflowJobId) {
                        await this.stateManager.saveState(
                            workflowJobId,
                            context,
                        );
                    }
                    throw error;
                }

                // Handle stage failure
                await this.handleStageFailure(
                    stage,
                    context,
                    error,
                    workflowJobId,
                );
                throw error;
            }
        }

        // Clear current stage on completion
        context.currentStage = undefined;

        // Persist final state
        if (this.stateManager && workflowJobId) {
            await this.stateManager.saveState(workflowJobId, context);
        }

        this.logger.log({
            message: `Pipeline execution completed successfully`,
            context: CodeReviewPipelineExecutor.name,
            metadata: {
                workflowJobId,
                correlationId: context.correlationId,
            },
        });

        return context;
    }

    /**
     * Execute a single stage
     * Detects light vs heavy stages and routes to appropriate execution path
     */
    private async executeStage(
        stage: Stage,
        context: CodeReviewPipelineContext,
        workflowJobId?: string,
    ): Promise<CodeReviewPipelineContext> {
        // Light stage: execute directly
        if (stage.isLight()) {
            return await stage.execute(context);
        }

        // Heavy stage: execute asynchronously (pauses workflow)
        return await this.executeHeavyStage(
            stage as HeavyStage,
            context,
            workflowJobId,
        );
    }

    /**
     * Execute a heavy stage
     * Calls start(), gets taskId, and throws WorkflowPausedError to pause workflow
     */
    private async executeHeavyStage(
        stage: HeavyStage,
        context: CodeReviewPipelineContext,
        workflowJobId?: string,
    ): Promise<CodeReviewPipelineContext> {
        this.logger.log({
            message: `Starting heavy stage '${stage.name}'`,
            context: CodeReviewPipelineExecutor.name,
            metadata: {
                workflowJobId,
                stageName: stage.name,
                eventType: stage.eventType,
                timeout: stage.timeout,
                correlationId: context.correlationId,
            },
        });

        // Start heavy stage execution
        const taskId = await stage.start(context);

        // Update context with taskId
        if (!context.tasks) {
            context.tasks = {};
        }
        context.tasks[stage.name.toLowerCase().replace(/\s+/g, '_')] = {
            taskId,
            status: 'pending' as any,
        };

        // Throw WorkflowPausedError to pause workflow
        // Worker will be freed and workflow will resume when event arrives
        throw new WorkflowPausedError(
            stage.eventType,
            taskId, // eventKey is the taskId
            stage.name,
            taskId,
            stage.timeout,
            {
                workflowJobId,
                correlationId: context.correlationId,
            },
        );
    }

    /**
     * Handle stage failure
     * Calls compensate() if stage implements it, then handles error
     */
    private async handleStageFailure(
        stage: Stage,
        context: CodeReviewPipelineContext,
        error: unknown,
        workflowJobId?: string,
    ): Promise<void> {
        this.logger.error({
            message: `Stage '${stage.name}' failed`,
            context: CodeReviewPipelineExecutor.name,
            error: error instanceof Error ? error : undefined,
            metadata: {
                workflowJobId,
                stageName: stage.name,
                correlationId: context.correlationId,
            },
        });

        // Call compensate if stage implements it
        if (stage.compensate) {
            try {
                await stage.compensate(context);
                this.logger.log({
                    message: `Compensation executed for stage '${stage.name}'`,
                    context: CodeReviewPipelineExecutor.name,
                    metadata: {
                        workflowJobId,
                        stageName: stage.name,
                        correlationId: context.correlationId,
                    },
                });
            } catch (compensationError) {
                this.logger.error({
                    message: `Compensation failed for stage '${stage.name}'`,
                    context: CodeReviewPipelineExecutor.name,
                    error:
                        compensationError instanceof Error
                            ? compensationError
                            : undefined,
                    metadata: {
                        workflowJobId,
                        stageName: stage.name,
                        correlationId: context.correlationId,
                    },
                });
            }
        }
    }

    /**
     * Build execution order based on stage dependencies
     * Uses topological sort to respect dependsOn relationships
     */
    private buildExecutionOrder(stages: Stage[]): string[] {
        const graph = new Map<string, Set<string>>();
        const inDegree = new Map<string, number>();
        const executionOrder: string[] = [];

        // Initialize graph
        for (const stage of stages) {
            graph.set(stage.name, new Set(stage.dependsOn || []));
            inDegree.set(stage.name, (stage.dependsOn || []).length);
        }

        // Validate dependencies exist
        for (const [stageName, dependencies] of graph) {
            for (const dep of dependencies) {
                if (!graph.has(dep)) {
                    throw new Error(
                        `Stage '${stageName}' depends on '${dep}', but '${dep}' is not found`,
                    );
                }
            }
        }

        // Topological sort
        const ready: string[] = [];
        for (const [stageName, degree] of inDegree) {
            if (degree === 0) {
                ready.push(stageName);
            }
        }

        while (ready.length > 0) {
            const stageName = ready.shift()!;
            executionOrder.push(stageName);

            // Update in-degree for dependent stages
            for (const [otherStageName, dependencies] of graph) {
                if (dependencies.has(stageName)) {
                    const newDegree = (inDegree.get(otherStageName) || 0) - 1;
                    inDegree.set(otherStageName, newDegree);
                    if (newDegree === 0) {
                        ready.push(otherStageName);
                    }
                }
            }
        }

        // Validate no cycles
        if (executionOrder.length !== stages.length) {
            const unprocessed = stages
                .map((s) => s.name)
                .filter((name) => !executionOrder.includes(name));
            throw new Error(
                `Circular dependency detected. Unprocessed stages: ${unprocessed.join(', ')}`,
            );
        }

        return executionOrder;
    }

    /**
     * Resume pipeline execution from a paused state
     * Called when event arrives indicating heavy stage completion
     */
    async resume(
        context: CodeReviewPipelineContext,
        stages: Stage[],
        taskId: string,
        workflowJobId: string,
    ): Promise<CodeReviewPipelineContext> {
        if (!context.currentStage) {
            throw new Error('Cannot resume: no current stage in context');
        }

        const stage = stages.find((s) => s.name === context.currentStage);
        if (!stage) {
            throw new Error(
                `Cannot resume: stage '${context.currentStage}' not found`,
            );
        }

        if (stage.isLight()) {
            throw new Error(
                `Cannot resume: stage '${stage.name}' is a light stage`,
            );
        }

        const heavyStage = stage as HeavyStage;

        // Resume with observability span
        if (this.observability) {
            return await this.observability.runInSpan(
                'pipeline.executor.resume',
                async (span) => {
                    span.setAttributes({
                        'pipeline.workflow_job.id': workflowJobId,
                        'pipeline.stage.name': heavyStage.name,
                        'pipeline.stage.task.id': taskId,
                        'pipeline.correlation.id': context.correlationId || '',
                    });

                    return await this.resumePipelineInternal(
                        context,
                        stages,
                        taskId,
                        workflowJobId,
                        heavyStage,
                    );
                },
                {
                    'workflow.component': 'pipeline_executor',
                    'workflow.operation': 'resume_pipeline',
                },
            );
        }

        // Fallback if observability is not available
        return await this.resumePipelineInternal(
            context,
            stages,
            taskId,
            workflowJobId,
            heavyStage,
        );
    }

    /**
     * Internal resume logic
     */
    private async resumePipelineInternal(
        context: CodeReviewPipelineContext,
        stages: Stage[],
        taskId: string,
        workflowJobId: string,
        heavyStage: HeavyStage,
    ): Promise<CodeReviewPipelineContext> {
        this.logger.log({
            message: `Resuming heavy stage '${heavyStage.name}'`,
            context: CodeReviewPipelineExecutor.name,
            metadata: {
                workflowJobId,
                stageName: heavyStage.name,
                taskId,
                correlationId: context.correlationId,
            },
        });

        // Get result from heavy stage (fetches completed result)
        context = await heavyStage.getResult(context, taskId);

        // Resume stage execution (continues from where it paused)
        context = await heavyStage.resume(context, taskId);

        // Continue pipeline execution from next stage
        const executionOrder = this.buildExecutionOrder(stages);
        const currentIndex = executionOrder.indexOf(heavyStage.name);
        if (currentIndex === -1) {
            throw new Error(
                `Stage '${heavyStage.name}' not found in execution order`,
            );
        }

        // Execute remaining stages
        for (let i = currentIndex + 1; i < executionOrder.length; i++) {
            const nextStageName = executionOrder[i];
            const nextStage = stages.find((s) => s.name === nextStageName);
            if (!nextStage) {
                throw new Error(`Stage '${nextStageName}' not found`);
            }

            context.currentStage = nextStageName;

            if (this.stateManager) {
                await this.stateManager.saveState(workflowJobId, context);
            }

            try {
                // Execute stage with observability span
                if (this.observability) {
                    context = await this.observability.runInSpan(
                        `pipeline.stage.${nextStageName}`,
                        async (span) => {
                            span.setAttributes({
                                'pipeline.stage.name': nextStageName,
                                'pipeline.stage.type': nextStage.isLight()
                                    ? 'light'
                                    : 'heavy',
                                'pipeline.workflow_job.id': workflowJobId,
                                'pipeline.correlation.id':
                                    context.correlationId || '',
                            });

                            return await this.executeStage(
                                nextStage,
                                context,
                                workflowJobId,
                            );
                        },
                        {
                            'workflow.component': 'pipeline_stage',
                            'workflow.operation': 'execute_stage',
                        },
                    );
                } else {
                    context = await this.executeStage(
                        nextStage,
                        context,
                        workflowJobId,
                    );
                }

                if (this.stateManager) {
                    await this.stateManager.saveState(workflowJobId, context);
                }
            } catch (error) {
                if (error instanceof WorkflowPausedError) {
                    if (this.stateManager) {
                        await this.stateManager.saveState(
                            workflowJobId,
                            context,
                        );
                    }
                    throw error;
                }
                await this.handleStageFailure(
                    nextStage,
                    context,
                    error,
                    workflowJobId,
                );
                throw error;
            }
        }

        context.currentStage = undefined;
        if (this.stateManager) {
            await this.stateManager.saveState(workflowJobId, context);
        }

        return context;
    }
}
