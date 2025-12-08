import { createLogger } from '@kodus/flow';
import { v4 as uuid } from 'uuid';
import { PipelineContext } from './interfaces/pipeline-context.interface';
import { PipelineStage } from './interfaces/pipeline.interface';
import { AutomationStatus } from '@libs/automation/domain/enums/automation-status';
import { WorkflowPausedError } from './errors/workflow-paused.error';

export class PipelineExecutor<TContext extends PipelineContext> {
    private readonly logger = createLogger(PipelineExecutor.name);
    constructor() {}

    /**
     * Builds a dependency graph from pipeline stages.
     * Returns a Map where keys are stage names and values are sets of stage names they depend on.
     */
    private buildDependencyGraph(
        stages: PipelineStage<TContext>[],
    ): Map<string, Set<string>> {
        const graph = new Map<string, Set<string>>();

        // Initialize graph with all stages
        for (const stage of stages) {
            graph.set(stage.stageName, new Set(stage.dependsOn || []));
        }

        // Validate that all dependencies exist
        for (const [stageName, dependencies] of graph) {
            for (const dep of dependencies) {
                if (!graph.has(dep)) {
                    throw new Error(
                        `Stage '${stageName}' depends on '${dep}', but '${dep}' is not found in pipeline`,
                    );
                }
            }
        }

        return graph;
    }

    /**
     * Performs topological sort to determine execution phases.
     * Stages in the same phase can execute in parallel.
     * Returns an array of phases, where each phase is an array of stage names.
     */
    private topologicalSort(graph: Map<string, Set<string>>): string[][] {
        const phases: string[][] = [];
        const inDegree = new Map<string, number>();
        const ready: string[] = [];

        // Calculate in-degree for each node
        for (const [node, deps] of graph) {
            inDegree.set(node, deps.size);
            if (deps.size === 0) {
                ready.push(node);
            }
        }

        // Process in phases
        while (ready.length > 0) {
            const phase: string[] = [];
            const nextReady: string[] = [];

            // Process all ready nodes in this phase
            for (const node of ready) {
                phase.push(node);

                // Update dependencies: reduce in-degree for nodes that depend on this node
                for (const [otherNode, deps] of graph) {
                    if (deps.has(node)) {
                        const newDegree = (inDegree.get(otherNode) || 0) - 1;
                        inDegree.set(otherNode, newDegree);

                        if (newDegree === 0) {
                            nextReady.push(otherNode);
                        }
                    }
                }
            }

            phases.push(phase);
            ready.length = 0;
            ready.push(...nextReady);
        }

        // Validate that there are no cycles
        const totalProcessed = phases.reduce(
            (sum, phase) => sum + phase.length,
            0,
        );
        if (totalProcessed !== graph.size) {
            const unprocessed = Array.from(graph.keys()).filter(
                (node) => !phases.some((phase) => phase.includes(node)),
            );
            throw new Error(
                `Circular dependency detected in pipeline stages. Unprocessed stages: ${unprocessed.join(', ')}`,
            );
        }

        return phases;
    }

    async execute(
        context: TContext,
        stages: PipelineStage<TContext>[],
        pipelineName = 'UnnamedPipeline',
        parentPipelineId?: string,
        rootPipelineId?: string,
    ): Promise<TContext> {
        const pipelineId = uuid();

        context.pipelineMetadata = {
            ...(context.pipelineMetadata || {}),
            pipelineId,
            parentPipelineId,
            rootPipelineId: rootPipelineId || pipelineId,
            pipelineName,
        };

        this.logger.log({
            message: `Starting pipeline: ${pipelineName} (ID: ${pipelineId})`,
            context: PipelineExecutor.name,
            serviceName: PipelineExecutor.name,
            metadata: {
                ...context?.pipelineMetadata,
                correlationId: (context as any)?.correlationId ?? null,
                organizationAndTeamData:
                    (context as any)?.organizationAndTeamData ?? null,
                status: context.statusInfo,
            },
        });

        // Build dependency graph and determine execution phases
        const graph = this.buildDependencyGraph(stages);
        const phases = this.topologicalSort(graph);

        this.logger.log({
            message: `Pipeline execution plan: ${phases.length} phases`,
            context: PipelineExecutor.name,
            serviceName: PipelineExecutor.name,
            metadata: {
                ...context?.pipelineMetadata,
                phases: phases.map((phase, idx) => ({
                    phase: idx + 1,
                    stages: phase,
                    parallel: phase.length > 1,
                })),
            },
        });

        // Execute stages phase by phase
        for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
            const phase = phases[phaseIndex];

            if (context.statusInfo.status === AutomationStatus.SKIPPED) {
                this.logger.log({
                    message: `Pipeline '${pipelineName}' skipped due to SKIP status ${pipelineId}`,
                    context: PipelineExecutor.name,
                    serviceName: PipelineExecutor.name,
                    metadata: {
                        ...context?.pipelineMetadata,
                        phase: phaseIndex + 1,
                        stages: phase,
                        correlationId: (context as any)?.correlationId ?? null,
                        organizationAndTeamData:
                            (context as any)?.organizationAndTeamData ?? null,
                        status: context.statusInfo,
                    },
                });
                break;
            }

            // Get stages for this phase
            const phaseStages = stages.filter((s) =>
                phase.includes(s.stageName),
            );

            // Execute stages in this phase in parallel
            const phaseStart = Date.now();
            const results = await Promise.allSettled(
                phaseStages.map((stage) => stage.execute(context)),
            );

            // Process results
            const errors: Array<{ stage: string; error: Error }> = [];
            let lastSuccessfulContext: TContext | null = null;

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const stage = phaseStages[i];

                if (result.status === 'fulfilled') {
                    lastSuccessfulContext = result.value;
                    this.logger.log({
                        message: `Stage '${stage.stageName}' completed in phase ${phaseIndex + 1}`,
                        context: PipelineExecutor.name,
                        serviceName: PipelineExecutor.name,
                        metadata: {
                            task: (result.value as any)?.tasks ?? null,
                            ...context?.pipelineMetadata,
                            stage: stage.stageName,
                            phase: phaseIndex + 1,
                            correlationId:
                                (result.value as any)?.correlationId ?? null,
                            organizationAndTeamData:
                                (result.value as any)
                                    ?.organizationAndTeamData ?? null,
                            status: (result.value as any)?.statusInfo,
                        },
                    });
                } else {
                    const error = result.reason as Error;

                    // If error is WorkflowPausedError, propagate it immediately (don't treat as failure)
                    if (error instanceof WorkflowPausedError) {
                        this.logger.log({
                            message: `Stage '${stage.stageName}' paused workflow waiting for event: ${error.eventType}`,
                            context: PipelineExecutor.name,
                            serviceName: PipelineExecutor.name,
                            metadata: {
                                ...context?.pipelineMetadata,
                                stage: stage.stageName,
                                phase: phaseIndex + 1,
                                eventType: error.eventType,
                                eventKey: error.eventKey,
                                timeout: error.timeout,
                                correlationId:
                                    (context as any)?.correlationId ?? null,
                            },
                        });
                        // Re-throw to allow processor to handle pause
                        throw error;
                    }

                    errors.push({ stage: stage.stageName, error });

                    this.logger.error({
                        message: `Stage '${stage.stageName}' failed in phase ${phaseIndex + 1}: ${error.message}`,
                        context: PipelineExecutor.name,
                        serviceName: PipelineExecutor.name,
                        error: error,
                        metadata: {
                            correlationId:
                                (context as any)?.correlationId ?? null,
                            ...context?.pipelineMetadata,
                            stage: stage.stageName,
                            phase: phaseIndex + 1,
                            organizationAndTeamData:
                                (context as any)?.organizationAndTeamData ??
                                null,
                            status: context.statusInfo,
                        },
                    });
                }
            }

            // Update context with last successful result (if any)
            // Note: In parallel execution, we merge results or use the last one
            // This is a simplification - in practice, stages should not modify context in conflicting ways
            if (lastSuccessfulContext) {
                context = lastSuccessfulContext;
            }

            // Handle errors: if any stage failed, log warning but continue
            // (existing behavior - pipeline continues despite errors)
            if (errors.length > 0) {
                this.logger.warn({
                    message: `Pipeline '${pipelineName}:${pipelineId}' phase ${phaseIndex + 1} had ${errors.length} error(s), continuing`,
                    context: PipelineExecutor.name,
                    serviceName: PipelineExecutor.name,
                    metadata: {
                        ...context?.pipelineMetadata,
                        phase: phaseIndex + 1,
                        errors: errors.map((e) => ({
                            stage: e.stage,
                            message: e.error.message,
                        })),
                        correlationId: (context as any)?.correlationId ?? null,
                        organizationAndTeamData:
                            (context as any)?.organizationAndTeamData ?? null,
                        status: context.statusInfo,
                    },
                });
            }

            const phaseDuration = Date.now() - phaseStart;
            this.logger.log({
                message: `Phase ${phaseIndex + 1} completed in ${phaseDuration}ms (${phase.length} stage(s))`,
                context: PipelineExecutor.name,
                serviceName: PipelineExecutor.name,
                metadata: {
                    ...context?.pipelineMetadata,
                    phase: phaseIndex + 1,
                    stages: phase,
                    duration: phaseDuration,
                    parallel: phase.length > 1,
                },
            });
        }

        this.logger.log({
            message: `Finished pipeline: ${pipelineName} (ID: ${pipelineId})`,
            context: PipelineExecutor.name,
            serviceName: PipelineExecutor.name,
            metadata: {
                ...context?.pipelineMetadata,
                correlationId: (context as any)?.correlationId ?? null,
                organizationAndTeamData:
                    (context as any)?.organizationAndTeamData ?? null,
            },
        });

        return context;
    }
}
