import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
    PromptExternalReferencesModel,
    PromptExternalReferencesSchema,
} from '@/core/infrastructure/adapters/repositories/mongoose/schema/promptExternalReferences.model';
import { PromptExternalReferencesRepository } from '@/core/infrastructure/adapters/repositories/mongoose/repositories/promptExternalReferences.repository';
import { PROMPT_EXTERNAL_REFERENCE_REPOSITORY_TOKEN } from '@/core/domain/prompts/contracts/promptExternalReferenceRepository.contract';
import { PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN } from '@/core/domain/prompts/contracts/promptContextEngine.contract';
import { PromptContextEngineService } from '@/core/infrastructure/adapters/services/prompts/promptContextEngine.service';
import { PromptExternalReferenceManagerService } from '@/core/infrastructure/adapters/services/prompts/promptExternalReferenceManager.service';
import { PromptContextLoaderService } from '@/core/infrastructure/adapters/services/prompts/promptContextLoader.service';
import { LoadExternalContextStage } from '@/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/load-external-context.stage';
import { LogModule } from './log.module';
import { PlatformIntegrationModule } from './platformIntegration.module';
import { forwardRef } from '@nestjs/common';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: PromptExternalReferencesModel.name,
                schema: PromptExternalReferencesSchema,
            },
        ]),
        LogModule,
        forwardRef(() => PlatformIntegrationModule),
    ],
    providers: [
        {
            provide: PROMPT_EXTERNAL_REFERENCE_REPOSITORY_TOKEN,
            useClass: PromptExternalReferencesRepository,
        },
        {
            provide: PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN,
            useClass: PromptContextEngineService,
        },
        PromptExternalReferenceManagerService,
        PromptContextLoaderService,
        LoadExternalContextStage,
    ],
    exports: [
        PROMPT_EXTERNAL_REFERENCE_REPOSITORY_TOKEN,
        PROMPT_CONTEXT_ENGINE_SERVICE_TOKEN,
        PromptExternalReferenceManagerService,
        PromptContextLoaderService,
        LoadExternalContextStage,
    ],
})
export class PromptsModule {}

