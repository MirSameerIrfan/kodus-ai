import { Module } from '@nestjs/common';
import { BusinessRulesValidationAgentUseCase } from '../application/use-cases/business-rules-validation-agent.use-case';
import { ConversationAgentUseCase } from '../application/use-cases/conversation-agent.use-case';
import { ContextEvidenceAgentProvider } from '../infrastructure/services/kodus-flow/contextEvidenceAgent.provider';
import { BusinessRulesValidationAgentProvider } from '../infrastructure/services/kodus-flow/businessRulesValidationAgent';
import { ConversationAgentProvider } from '../infrastructure/services/kodus-flow/conversationAgent';

@Module({
    imports: [],
    providers: [
        BusinessRulesValidationAgentUseCase,
        ConversationAgentUseCase,
        ContextEvidenceAgentProvider,
        BusinessRulesValidationAgentProvider,
        ConversationAgentProvider,
    ],
    exports: [
        BusinessRulesValidationAgentUseCase,
        ConversationAgentUseCase,
        ContextEvidenceAgentProvider,
        BusinessRulesValidationAgentProvider,
        ConversationAgentProvider,
    ],
})
export class AgentsModule {}
