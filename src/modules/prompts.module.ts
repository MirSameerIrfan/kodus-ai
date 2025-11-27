import { PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN } from '@/core/domain/prompts/contracts/promptContextEngine.contract';
import { PROMPT_CONTEXT_LOADER_SERVICE_TOKEN } from '@/core/domain/prompts/contracts/promptContextLoader.contract';
import { PROMPT_EXTERNAL_REFERENCE_MANAGER_SERVICE_TOKEN } from '@/core/domain/prompts/contracts/promptExternalReferenceManager.contract';
import { LOAD_EXTERNAL_CONTEXT_STAGE_TOKEN } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/contracts/loadExternalContextStage.contract';
import { LoadExternalContextStage } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/load-external-context.stage';
import { PromptContextEngineService } from '@/core/infrastructure/adapters/services/prompts/promptContextEngine.service';
import { PromptContextLoaderService } from '@/core/infrastructure/adapters/services/prompts/promptContextLoader.service';
import { PromptExternalReferenceManagerService } from '@/core/infrastructure/adapters/services/prompts/promptExternalReferenceManager.service';
import { Module, forwardRef } from '@nestjs/common';
import { ContextReferenceModule } from './contextReference.module';
import { IntegrationConfigModule } from './integrationConfig.module';
import { LogModule } from './log.module';
import { PlatformIntegrationModule } from './platformIntegration.module';

@Module({
    imports: [
        LogModule,
        forwardRef(() => PlatformIntegrationModule),
        forwardRef(() => ContextReferenceModule),
        forwardRef(() => IntegrationConfigModule),
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
