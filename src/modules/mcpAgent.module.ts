import { BusinessRulesValidationAgentUseCase } from '@/core/application/use-cases/agent/business-rules-validation-agent.use-case';
import { ConversationAgentUseCase } from '@/core/application/use-cases/agent/conversation-agent.use-case';
import { BusinessRulesValidationAgentProvider } from '@/core/infrastructure/adapters/services/agent/kodus-flow/businessRulesValidationAgent';
import { ContextEvidenceAgentProvider } from '@/core/infrastructure/adapters/services/agent/kodus-flow/contextEvidenceAgent.provider';
import { ConversationAgentProvider } from '@/core/infrastructure/adapters/services/agent/kodus-flow/conversationAgent';
import { PermissionValidationModule } from '@/ee/shared/permission-validation.module';
import { Module, forwardRef } from '@nestjs/common';
import { ParametersModule } from './parameters.module';

@Module({
    imports: [
        forwardRef(() => ParametersModule),
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [
        ConversationAgentProvider,
        ConversationAgentUseCase,
        BusinessRulesValidationAgentProvider,
        BusinessRulesValidationAgentUseCase,
        ContextEvidenceAgentProvider,
    ],
    exports: [
        ConversationAgentProvider,
        ConversationAgentUseCase,
        BusinessRulesValidationAgentProvider,
        BusinessRulesValidationAgentUseCase,
        ContextEvidenceAgentProvider,
    ],
})
export class McpAgentModule {}
