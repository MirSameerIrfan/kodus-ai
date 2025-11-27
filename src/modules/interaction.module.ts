import { INTERACTION_EXECUTION_REPOSITORY_TOKEN } from '@/core/domain/interactions/contracts/interaction.repository.contracts';
import { INTERACTION_SERVICE_TOKEN } from '@/core/domain/interactions/contracts/interaction.service.contracts';
import { InteractionExecutionDatabaseRepository } from '@/core/infrastructure/adapters/repositories/mongoose/interactionExecution.repository';
import { InteractionModelInstance } from '@/core/infrastructure/adapters/repositories/mongoose/schema';
import { InteractionService } from '@/core/infrastructure/adapters/services/interaction.service';
import { TeamsModule } from '@/modules/team.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
    imports: [
        MongooseModule.forFeature([InteractionModelInstance]),
        TeamsModule,
    ],
    providers: [
        {
            provide: INTERACTION_SERVICE_TOKEN,
            useClass: InteractionService,
        },
        {
            provide: INTERACTION_EXECUTION_REPOSITORY_TOKEN,
            useClass: InteractionExecutionDatabaseRepository,
        },
    ],
    controllers: [],
})
export class InteractionModule {}
