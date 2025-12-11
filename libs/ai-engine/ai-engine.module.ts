import { ReferenceDetectorService } from './infrastructure/adapters/services/reference-detector.service';
import { PromptContextEngineService } from './infrastructure/adapters/services/prompt/promptContextEngine.service';
import { PromptContextLoaderService } from './infrastructure/adapters/services/orchestration/promptContextLoader.service';
import { ContextReferenceDetectionService } from './infrastructure/adapters/services/context/context-reference-detection.service';
import { ContextReferenceService } from './infrastructure/adapters/services/context/context-reference.service';
import { MCPToolArgResolverAgentService } from './infrastructure/adapters/services/context/mcp-tool-arg-resolver-agent.service';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { SharedLogModule } from '@libs/shared/infrastructure/shared-log.module';
import { CodebaseModule } from '@libs/code-review/code-review.module';
import { PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN } from './domain/prompt/contracts/promptContextEngine.contract';
import { PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN } from './domain/prompt/contracts/promptExternalReferenceManager.contract';
import { PROMPT_CONTEXT_LOADER_SERVICE_TOKEN } from './domain/prompt/contracts/promptContextLoader.contract';
import { forwardRef, Module } from '@nestjs/common';
import { CodeReviewContextPackService } from './infrastructure/adapters/services/context/code-review-context-pack.service';
import { PromptExternalReferenceManagerService } from './infrastructure/adapters/services/prompt/promptExternalReferenceManager.service';
import { FileContextAugmentationService } from './infrastructure/adapters/services/context/file-context-augmentation.service';

@Module({
    imports: [
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => CodebaseModule), // For CodeManagementService dependency
        SharedLogModule,
    ],
    providers: [
        ReferenceDetectorService,
        {
            provide: PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN,
            useClass: PromptContextEngineService,
        },
        {
            provide: PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
            useClass: PromptExternalReferenceManagerService,
        },
        {
            provide: PROMPT_CONTEXT_LOADER_SERVICE_TOKEN,
            useClass: PromptContextLoaderService,
        },
        CodeReviewContextPackService,
        ContextReferenceDetectionService,
        ContextReferenceService,
        FileContextAugmentationService,
        MCPToolArgResolverAgentService,
    ],
    exports: [
        ReferenceDetectorService,
        PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN,
        PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
        PROMPT_CONTEXT_LOADER_SERVICE_TOKEN,
        CodeReviewContextPackService,
        ContextReferenceDetectionService,
        ContextReferenceService,
        FileContextAugmentationService,
        MCPToolArgResolverAgentService,
    ],
})
export class AIEngineModule {}
