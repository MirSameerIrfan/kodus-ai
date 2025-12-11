import { Module } from '@nestjs/common';
import { BusinessRulesValidationAgentUseCase } from '../application/use-cases/business-rules-validation-agent.use-case';
import { ConversationAgentUseCase } from '../application/use-cases/conversation-agent.use-case';
import { BaseAgentProvider } from '../infrastructure/services/kodus-flow/base-agent.provider';
import { BusinessRulesValidationAgent } from '../infrastructure/services/kodus-flow/businessRulesValidationAgent';
import { ContextEvidenceAgentProvider } from '../infrastructure/services/kodus-flow/contextEvidenceAgent.provider';
import { ConversationAgent } from '../infrastructure/services/kodus-flow/conversationAgent';

@Module({
    imports: [],
    providers: [
        BusinessRulesValidationAgentUseCase,
        ConversationAgentUseCase,
        BaseAgentProvider,
        BusinessRulesValidationAgent,
        ContextEvidenceAgentProvider,
        ConversationAgent,
    ],
    exports: [
        BusinessRulesValidationAgentUseCase,
        ConversationAgentUseCase,
        BaseAgentProvider,
        BusinessRulesValidationAgent,
        ContextEvidenceAgentProvider,
        ConversationAgent,
    ],
})
export class AgentsCoreModule {}
