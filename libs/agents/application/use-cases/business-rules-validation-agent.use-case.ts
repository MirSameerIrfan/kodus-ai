import { Injectable } from '@nestjs/common';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { Thread } from '@kodus/flow';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { BusinessRulesValidationAgentProvider } from '@libs/agents/infrastructure/services/kodus-flow/businessRulesValidationAgent';

@Injectable()
export class BusinessRulesValidationAgentUseCase implements IUseCase {
    constructor(
        private readonly businessRulesValidationAgentProvider: BusinessRulesValidationAgentProvider,
    ) {}

    async execute(context: {
        organizationAndTeamData: OrganizationAndTeamData;
        thread?: Thread;
        prepareContext?: any;
    }): Promise<string> {
        try {
            return await this.businessRulesValidationAgentProvider.execute(
                context,
            );
        } catch (error) {
            console.error(
                'Erro no use-case de validação de regras de negócio:',
                error,
            );
            throw new Error(
                `Falha ao processar validação de regras de negócio: ${error.message}`,
            );
        }
    }
}
