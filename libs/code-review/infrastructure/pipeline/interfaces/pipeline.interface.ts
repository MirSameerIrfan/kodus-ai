import { PipelineContext } from './pipeline-context.interface';

export interface PipelineStage<TContext extends PipelineContext> {
    stageName: string;
    /**
     * Names of stages that must complete before this stage can execute.
     * If not specified, stage can execute in parallel with other independent stages.
     */
    dependsOn?: string[];
    execute(context: TContext): Promise<TContext>;
}

export interface IPipeline<TContext extends PipelineContext> {
    pipeLineName: string;
    execute(context: TContext): Promise<TContext>;
}
