import { IUseCase } from '@shared/domain/interfaces/use-case.interface';
import { Injectable } from '@nestjs/common';
import { BusinessRulesValidationAgentProvider } from '@libs/agents/infrastructure/kodus-flow/kodus-flow/businessRulesValidationAgent';
import { OrganizationAndTeamData } from '@shared/types/general/organizationAndTeamData';
import { Thread } from '@kodus/flow';

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
