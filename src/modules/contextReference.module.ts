import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContextReferenceModel } from '@/core/infrastructure/adapters/repositories/typeorm/schema/contextReference.model';
import { ContextReferenceRepository } from '@/core/infrastructure/adapters/repositories/typeorm/contextReference.repository';
import { CONTEXT_REFERENCE_REPOSITORY_TOKEN } from '@/core/domain/contextReferences/contracts/context-revision.repository';
import { ContextReferenceService } from '@/core/infrastructure/adapters/services/context/context-reference.service';

@Module({
    imports: [TypeOrmModule.forFeature([ContextReferenceModel])],
    providers: [
        ContextReferenceService,
        {
            provide: CONTEXT_REFERENCE_REPOSITORY_TOKEN,
            useClass: ContextReferenceRepository,
        },
    ],
    exports: [ContextReferenceService, CONTEXT_REFERENCE_REPOSITORY_TOKEN],
})
export class ContextReferenceModule {}
