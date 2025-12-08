import { IUseCase } from '@shared/domain/interfaces/use-case.interface';
import { Injectable } from '@nestjs/common';
import { OrganizationAndTeamData } from '@shared/types/general/organizationAndTeamData';
import { Thread } from '@kodus/flow';
import { ConversationAgentProvider } from '@libs/agents/infrastructure/kodus-flow/kodus-flow/conversationAgent';

@Injectable()
export class ConversationAgentUseCase implements IUseCase {
    constructor(
        private readonly conversationAgentProvider: ConversationAgentProvider,
    ) {}

    async execute(context: {
        prompt: string;
        organizationAndTeamData?: OrganizationAndTeamData;
        thread?: Thread;
        prepareContext?: any;
    }): Promise<any> {
        try {
            const { prompt, organizationAndTeamData, prepareContext, thread } =
                context;

            return await this.conversationAgentProvider.execute(prompt, {
                organizationAndTeamData,
                prepareContext,
                thread,
            });
        } catch (error) {
            console.error('Erro no use-case de conversação:', error);
            throw new Error(`Falha ao processar conversação: ${error.message}`);
        }
    }
}
