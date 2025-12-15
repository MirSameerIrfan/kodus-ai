import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { SharedObservabilityModule } from '@libs/shared/infrastructure/shared-observability.module';
import { McpModule } from '@libs/mcp-server/mcp.module';
import { SharedConfigModule } from '@libs/shared/infrastructure/shared-config.module';
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';

import { BusinessRulesValidationAgentUseCase } from '../application/use-cases/business-rules-validation-agent.use-case';
import { ConversationAgentUseCase } from '../application/use-cases/conversation-agent.use-case';
import { ContextEvidenceAgentProvider } from '../infrastructure/services/kodus-flow/contextEvidenceAgent.provider';
import { BusinessRulesValidationAgentProvider } from '../infrastructure/services/kodus-flow/businessRulesValidationAgent';
import { ConversationAgentProvider } from '../infrastructure/services/kodus-flow/conversationAgent';
import { LLMModule } from '@kodus/kodus-common/llm';

@Module({
    imports: [
        ConfigModule,
        forwardRef(() => PermissionValidationModule),
        SharedObservabilityModule,
        McpModule,
        SharedConfigModule,
        forwardRef(() => OrganizationModule),
        forwardRef(() => ParametersModule),
        LLMModule,
    ],
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
