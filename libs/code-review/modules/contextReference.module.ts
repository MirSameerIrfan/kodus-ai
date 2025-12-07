import { CONTEXT_REFERENCE_REPOSITORY_TOKEN } from '@libs/core/domain/contextReferences/contracts/context-reference.repository.contract';
import { CONTEXT_REFERENCE_SERVICE_TOKEN } from '@libs/core/domain/contextReferences/contracts/context-reference.service.contract';
import { MCPToolMetadataService } from '@libs/core/infrastructure/adapters/mcp/services/mcp-tool-metadata.service';
import { ContextReferenceRepository } from '@libs/core/infrastructure/adapters/repositories/typeorm/contextReference.repository';
import { ContextReferenceModel } from '@libs/core/infrastructure/adapters/repositories/typeorm/schema/contextReference.model';
import { CodeReviewContextPackService } from '@libs/core/infrastructure/adapters/services/context/code-review-context-pack.service';
import { ContextReferenceDetectionService } from '@libs/core/infrastructure/adapters/services/context/context-reference-detection.service';
import { ContextReferenceService } from '@libs/core/infrastructure/adapters/services/context/context-reference.service';
import { MCPToolArgResolverAgentService } from '@libs/core/infrastructure/adapters/services/context/mcp-tool-arg-resolver-agent.service';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformIntegrationModule } from '@libs/platform/platform.module';
import { PromptsModule } from '@libs/code-review/modules/prompts.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ContextReferenceModel]),
        forwardRef(() => PermissionValidationModule),
        forwardRef(() => PromptsModule),
        forwardRef(() => PlatformIntegrationModule),
    ],
    providers: [
        ContextReferenceService,
        ContextReferenceDetectionService,
        CodeReviewContextPackService,
        MCPToolArgResolverAgentService,
        MCPToolMetadataService,
        {
            provide: CONTEXT_REFERENCE_SERVICE_TOKEN,
            useExisting: ContextReferenceService,
        },
        {
            provide: CONTEXT_REFERENCE_REPOSITORY_TOKEN,
            useClass: ContextReferenceRepository,
        },
    ],
    exports: [
        ContextReferenceService,
        ContextReferenceDetectionService,
        CodeReviewContextPackService,
        MCPToolArgResolverAgentService,
        MCPToolMetadataService,
        CONTEXT_REFERENCE_SERVICE_TOKEN,
        CONTEXT_REFERENCE_REPOSITORY_TOKEN,
    ],
})
export class ContextReferenceModule {}
