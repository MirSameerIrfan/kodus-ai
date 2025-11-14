import { Body, Controller, Post } from '@nestjs/common';
import { RunInteractionUserUseCase } from '@/core/application/use-cases/interaction/run-interaction-user.use-case';
import { InteractionDto } from '@/shared/domain/dtos/interaction.dtos';

// TODO: remove, unused
@Controller('interaction')
export class InteractionController {
    constructor(
        private readonly runInteractionUserUseCase: RunInteractionUserUseCase,
    ) {}

    // TODO: remove, unused
    @Post('users')
    public async users(
        @Body()
        body: InteractionDto,
    ) {
        return this.runInteractionUserUseCase.execute(body);
    }
}
