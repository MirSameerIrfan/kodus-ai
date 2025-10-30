import {
    ContextRevisionHistoryQuery,
    ContextRevisionFilter,
    IContextReferenceRepository,
    CONTEXT_REFERENCE_REPOSITORY_TOKEN,
    CreateContextRevisionParams,
} from '@/core/domain/contextReferences/contracts/context-revision.repository';
import { ContextReferenceModel } from './schema/contextReference.model';
import type {
    ContextRevisionActor,
    ContextRevisionLogEntry,
    ContextRequirement,
} from '@context-os-core/interfaces.js';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, FindManyOptions } from 'typeorm';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';

function modelToLogEntry(
    model: ContextReferenceModel,
): ContextRevisionLogEntry {
    return {
        revisionId: model.revisionId,
        parentRevisionId: model.parentRevisionId ?? undefined,
        scope: model.scope,
        entityType: model.entityType,
        entityId: model.entityId,
        payload: model.payload,
        requirements: model.requirements ?? undefined,
        knowledgeRefs: model.knowledgeRefs ?? undefined,
        origin: model.origin ?? undefined,
        createdAt: model.createdAt?.getTime() ?? Date.now(),
        metadata: model.metadata ?? undefined,
    };
}

function applyFilter(
    filter: ContextRevisionFilter,
): FindOptionsWhere<ContextReferenceModel> {
    const where: FindOptionsWhere<ContextReferenceModel> = {};

    if (filter.revisionId) {
        where.revisionId = filter.revisionId;
    }

    if (filter.scope) {
        where.scope = filter.scope as ContextReferenceModel['scope'];
    }

    if (filter.entityType) {
        where.entityType = filter.entityType;
    }

    if (filter.entityId) {
        where.entityId = filter.entityId;
    }

    return where;
}

@Injectable()
export class ContextReferenceRepository implements IContextReferenceRepository {
    constructor(
        @InjectRepository(ContextReferenceModel)
        private readonly repository: Repository<ContextReferenceModel>,
        private readonly logger: PinoLoggerService,
    ) {}

    async createRevision(
        params: CreateContextRevisionParams,
    ): Promise<ContextRevisionLogEntry> {
        try {
            const model = this.repository.create({
                revisionId: params.revisionId,
                parentRevisionId: params.parentRevisionId,
                scope: params.scope,
                entityType: params.entityType,
                entityId: params.entityId,
            payload: params.payload,
            requirements: params.requirements as ContextRequirement[] | undefined,
            knowledgeRefs: params.knowledgeRefs,
            origin: params.origin as ContextRevisionActor | undefined,
            metadata: params.metadata,
        });

            const saved = await this.repository.save(model);
            return modelToLogEntry(saved);
        } catch (error) {
            this.logger.error({
                message: 'Failed to create context reference',
                context: ContextReferenceRepository.name,
                error,
                metadata: { entityType: params.entityType, entityId: params.entityId },
            });
            throw error;
        }
    }

    async getRevision(revisionId: string): Promise<ContextRevisionLogEntry | null> {
        const result = await this.repository.findOne({
            where: { revisionId },
        });
        return result ? modelToLogEntry(result) : null;
    }

    async getRevisionHistory(
        query: ContextRevisionHistoryQuery,
    ): Promise<ContextRevisionLogEntry[]> {
        const where: FindOptionsWhere<ContextReferenceModel> = {
            entityType: query.entityType,
            entityId: query.entityId,
        };

        if (query.scope) {
            where.scope = query.scope as ContextReferenceModel['scope'];
        }

        const options: FindManyOptions<ContextReferenceModel> = {
            where,
            order: { createdAt: 'DESC' },
            take: query.limit,
            skip: query.offset,
        };

        const results = await this.repository.find(options);
        return results.map(modelToLogEntry);
    }

    async deleteRevision(revisionId: string): Promise<void> {
        await this.repository.delete({ revisionId });
    }

    async getLatestRevision(
        filter: ContextRevisionFilter,
    ): Promise<ContextRevisionLogEntry | null> {
        const where = applyFilter(filter);

        const model = await this.repository.findOne({
            where,
            order: { createdAt: 'DESC' },
        });

        return model ? modelToLogEntry(model) : null;
    }
}
