import { IInteractionExecution } from '@libs/analytics/domain/interactions/interfaces/interactions-execution.interface';

export const INTERACTION_EXECUTION_REPOSITORY_TOKEN = Symbol(
    'InteractionExecutionRepository',
);

export interface IInteractionExecutionRepository {
    create(
        interactionExecution: IInteractionExecution,
    ): Promise<IInteractionExecution>;
}
