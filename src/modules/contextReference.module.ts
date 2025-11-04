import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContextReferenceModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/contextReference.model';
import { ContextReferenceRepository } from '@/core/infrastructure/adapters/repositories/typeorm/contextReference.repository';
import { CONTEXT_REFERENCE_REPOSITORY_TOKEN } from '@/core/domain/contextReferences/contracts/context-reference.repository.contract';
import { ContextReferenceService } from '@/core/infrastructure/adapters/services/context/context-reference.service';
import { CodeReviewContextPackService } from '@/core/infrastructure/adapters/services/context/code-review-context-pack.service';
import { CONTEXT_REFERENCE_SERVICE_TOKEN } from '@/core/domain/contextReferences/contracts/context-reference.service.contract';

@Module({
    imports: [TypeOrmModule.forFeature([ContextReferenceModel])],
    providers: [
        ContextReferenceService,
        CodeReviewContextPackService,
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
        CodeReviewContextPackService,
        CONTEXT_REFERENCE_SERVICE_TOKEN,
        CONTEXT_REFERENCE_REPOSITORY_TOKEN,
    ],
})
export class ContextReferenceModule {}
