import { IInteractionExecution } from '../interfaces/interactions-execution.interface';

export const INTERACTION_SERVICE_TOKEN = Symbol('InteractionService');

export interface IInteractionService {
    createInteraction(
        interaction: Partial<IInteractionExecution>,
    ): Promise<void>;
}
