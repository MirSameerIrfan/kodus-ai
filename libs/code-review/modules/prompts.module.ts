import { Module, forwardRef } from '@nestjs/common';

import { ContextReferenceModule } from '@libs/code-review/modules/contextReference.module';
import { PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN } from '@libs/core/ai-engine/domain/contracts/promptContextEngine.contract';
import { PROMPT_CONTEXT_LOADER_SERVICE_TOKEN } from '@libs/core/ai-engine/domain/contracts/promptContextLoader.contract';
import { PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN } from '@libs/core/ai-engine/domain/contracts/promptExternalReferenceManager.contract';
import { LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN } from '@libs/code-review/pipeline/base/stages/contracts/loadExternalContextStage.contract';
import { LoadExternalContextStage } from '@libs/code-review/pipeline/base/stages/load-external-context.stage';
import { PromptContextEngineService } from '@libs/core/ai-engine/services/prompt/promptContextEngine.service';
import { PromptContextLoaderService } from '@libs/core/ai-engine/services/orchestration/promptContextLoader.service';
import { PromptExternalReferenceManagerService } from '@libs/core/ai-engine/services/prompt/promptExternalReferenceManager.service';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { LogModule } from '@libs/analytics/modules/log.module';
import { PlatformIntegrationModule } from '@libs/platform/modules/platform.module';
import { AIEngineModule } from '@libs/core/ai-engine/ai-engine.module';

@Module({
    imports: [
        LogModule,
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => ContextReferenceModule),
        forwardRef(() => IntegrationConfigModule),
        AIEngineModule,
    ],
    providers: [
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
        {
            provide: LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN,
            useClass: LoadExternalContextStage,
        },
    ],
    exports: [
        PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN,
        PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN,
        PROMPT_CONTEXT_LOADER_SERVICE_TOKEN,
        LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN,
    ],
})
export class PromptsModule {}
