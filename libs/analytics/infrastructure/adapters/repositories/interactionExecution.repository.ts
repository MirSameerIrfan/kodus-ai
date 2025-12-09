import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InteractionModel } from './schemas/interaction.model';
import { IInteractionExecutionRepository } from '@libs/analytics/domain/interactions/contracts/interaction.repository.contracts';
import { Model } from 'mongoose';
import { IInteractionExecution } from '@libs/analytics/domain/interactions/interfaces/interactions-execution.interface';

@Injectable()
export class InteractionExecutionDatabaseRepository implements IInteractionExecutionRepository {
    constructor(
        @InjectModel(InteractionModel.name)
        private readonly interactionExecutionModel: Model<InteractionModel>,
    ) {}

    async create(
        interactionExecution: IInteractionExecution,
    ): Promise<InteractionModel> {
        return this.interactionExecutionModel.create(interactionExecution);
    }
}
