import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IPromptExternalReferenceManagerService } from '@/core/domain/prompts/contracts/promptExternalReferenceManager.contract';
import { PromptExternalReferenceEntity } from '@/core/domain/prompts/entities/promptExternalReference.entity';
import {
    IFileReference,
    IPromptReferenceSyncError,
    PromptProcessingStatus,
    PromptReferenceErrorType,
    PromptSourceType,
} from '@/core/domain/prompts/interfaces/promptExternalReference.interface';
import { CONTEXT_REFERENCE_SERVICE_TOKEN } from '@/core/domain/contextReferences/contracts/context-reference.service.contract';
import { ContextReferenceService } from '@/core/infrastructure/adapters/services/context/context-reference.service';
import { PinoLoggerService } from '@/core/infrastructure/adapters/services/logger/pino.service';
import { ContextReferenceEntity } from '@/core/domain/contextReferences/entities/context-reference.entity';
import { computeRequirementsHash } from '@context-os-core/utils/context-requirements';
import type { ContextRequirement, ContextDependency } from '@context-os-core/interfaces';
import {
    resolveSourceTypeFromPath,
} from '../context/code-review-context.utils';

type ParsedConfigKey = {
    organizationId: string;
    repositoryId: string;
    repositoryName: string;
    directoryId?: string;
    configKey: string;
    entityId: string;
};

type NormalizedSyncError = {
    type: PromptReferenceErrorType;
    message: string;
    details: {
        fileName?: string;
        repositoryName?: string;
        attemptedPaths?: string[];
        timestamp?: string;
    };
};

@Injectable()
export class PromptExternalReferenceManagerService
    implements IPromptExternalReferenceManagerService
{
    constructor(
        @Inject(CONTEXT_REFERENCE_SERVICE_TOKEN)
        private readonly contextReferenceService: ContextReferenceService,
        private readonly logger: PinoLoggerService,
    ) {}

    buildConfigKey(
        organizationId: string,
        repositoryId: string,
        directoryId?: string,
    ): string {
        if (directoryId) {
            return `${organizationId}:${repositoryId}:${directoryId}`;
        }
        return `${organizationId}:${repositoryId}`;
    }

    buildConfigKeysHierarchy(
        organizationId: string,
        repositoryId: string,
        directoryId?: string,
    ): string[] {
        const keys: string[] = [];

        if (directoryId) {
            keys.push(`${organizationId}:${repositoryId}:${directoryId}`);
        }

        keys.push(`${organizationId}:${repositoryId}`);
        keys.push(`${organizationId}:global`);

        return keys;
    }

    async findByConfigKeys(
        configKeys: string[],
    ): Promise<PromptExternalReferenceEntity[]> {
        const aggregated: PromptExternalReferenceEntity[] = [];

        for (const configKey of configKeys) {
            const revision = await this.fetchLatestRevision(configKey);
            if (!revision) {
                continue;
            }

            const parsed = this.parseConfigKey(configKey);
            const entities = this.mapRevisionToReferences(revision, parsed);

            aggregated.push(...entities);
        }

        return aggregated;
    }

    async findByConfigKey(
        configKey: string,
        sourceType: PromptSourceType,
    ): Promise<PromptExternalReferenceEntity | null> {
        const references = await this.findByConfigKeys([configKey]);
        return (
            references.find(
                (entity) => entity.sourceType === sourceType,
            ) ?? null
        );
    }

    async getReference(
        configKey: string,
        sourceType: PromptSourceType,
    ): Promise<PromptExternalReferenceEntity | null> {
        return await this.findByConfigKey(configKey, sourceType);
    }

    async getMultipleReferences(
        configKey: string,
        sourceTypes: PromptSourceType[],
    ): Promise<Map<PromptSourceType, PromptExternalReferenceEntity>> {
        const result = new Map<
            PromptSourceType,
            PromptExternalReferenceEntity
        >();

        if (!sourceTypes.length) {
            return result;
        }

        const references = await this.findByConfigKeys([configKey]);

        for (const sourceType of sourceTypes) {
            const match = references.find(
                (entity) => entity.sourceType === sourceType,
            );
            if (match) {
                result.set(sourceType, match);
            }
        }

        return result;
    }

    private parseConfigKey(configKey: string): ParsedConfigKey {
        const parts = configKey.split(':');
        const organizationId = parts[0] ?? '';
        const repositoryId = parts[1] ?? 'global';
        const directoryId = parts.length > 2 ? parts[2] : undefined;

        const segments = [`org:${organizationId}`];
        if (repositoryId && repositoryId !== 'global') {
            segments.push(`repo:${repositoryId}`);
        }
        if (directoryId) {
            segments.push(`dir:${directoryId}`);
        }

        return {
            organizationId,
            repositoryId,
            repositoryName: repositoryId,
            directoryId,
            configKey,
            entityId: segments.join('/'),
        };
    }

    private async fetchLatestRevision(
        configKey: string,
    ): Promise<ContextReferenceEntity | undefined> {
        const parsed = this.parseConfigKey(configKey);
        try {
            return await this.contextReferenceService.getLatestRevision(
                'code_review_config',
                parsed.entityId,
            );
        } catch (error) {
            this.logger.warn({
                message: 'Failed to fetch context reference revision',
                context: PromptExternalReferenceManagerService.name,
                error,
                metadata: {
                    configKey,
                    entityId: parsed.entityId,
                },
            });
            return undefined;
        }
    }

    private mapRevisionToReferences(
        revision: ContextReferenceEntity,
        parsedKey: ParsedConfigKey,
    ): PromptExternalReferenceEntity[] {
        const requirements = revision.requirements ?? [];
        if (requirements.length === 0) {
            return [];
        }

        const requirementHash = computeRequirementsHash(requirements);
        const entities: PromptExternalReferenceEntity[] = [];

        for (const requirement of requirements) {
            const sourceType = this.resolveSourceType(requirement);
            if (!sourceType) {
                continue;
            }

            const references = this.extractReferencesFromRequirement(
                requirement,
                parsedKey.repositoryName,
            );

            const syncErrors = this.extractSyncErrorsFromRequirement(
                requirement,
            );

            const processingStatus =
                requirement.status === 'draft' ||
                (syncErrors.length > 0 && references.length === 0)
                    ? PromptProcessingStatus.FAILED
                    : PromptProcessingStatus.COMPLETED;

            const lastProcessedAt =
                this.extractLastProcessedAt(requirement, revision) ??
                new Date();

            const promptHash =
                typeof requirement.metadata?.promptHash === 'string'
                    ? requirement.metadata?.promptHash
                    : '';

            entities.push(
                PromptExternalReferenceEntity.create({
                    uuid: `${revision.uuid}:${requirement.id}:${randomUUID()}`,
                    configKey: parsedKey.configKey,
                    sourceType,
                    organizationId: parsedKey.organizationId,
                    repositoryId: parsedKey.repositoryId,
                    directoryId: parsedKey.directoryId,
                    repositoryName: parsedKey.repositoryName,
                    promptHash,
                    contextReferenceId: revision.uuid,
                    contextRequirementsHash: requirementHash,
                    references,
                    syncErrors,
                    processingStatus,
                    lastProcessedAt,
                    createdAt: revision.createdAt ?? undefined,
                    updatedAt: revision.updatedAt ?? undefined,
                }),
            );
        }

        return entities;
    }

    private resolveSourceType(
        requirement: ContextRequirement,
    ): PromptSourceType | undefined {
        if (requirement.metadata) {
            const rawSourceType = requirement.metadata.sourceType;
            if (
                typeof rawSourceType === 'string' &&
                this.isPromptSourceType(rawSourceType)
            ) {
                return rawSourceType;
            }
        }

        if (Array.isArray(requirement.metadata?.path)) {
            return resolveSourceTypeFromPath(
                requirement.metadata?.path as string[],
            );
        }

        return undefined;
    }

    private isPromptSourceType(
        value: string,
    ): value is PromptSourceType {
        return Object.values(PromptSourceType).includes(
            value as PromptSourceType,
        );
    }

    private extractReferencesFromRequirement(
        requirement: ContextRequirement,
        fallbackRepositoryName: string,
    ): IFileReference[] {
        const knowledgeDependencies =
            requirement.dependencies?.filter(
                (dependency) => dependency.type === 'knowledge',
            ) ?? [];

        const references: IFileReference[] = [];
        const seen = new Set<string>();

        for (const dependency of knowledgeDependencies) {
            const reference = this.mapDependencyToReference(
                dependency,
                fallbackRepositoryName,
            );

            if (!reference) {
                continue;
            }

            const key = `${reference.repositoryName ?? fallbackRepositoryName}:${reference.filePath}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            references.push(reference);
        }

        return references;
    }

    private mapDependencyToReference(
        dependency: ContextDependency,
        fallbackRepositoryName: string,
    ): IFileReference | undefined {
        const metadata = dependency.metadata as Record<string, unknown> | undefined;
        const filePath =
            typeof metadata?.filePath === 'string'
                ? metadata.filePath
                : undefined;

        if (!filePath) {
            return undefined;
        }

        const repositoryName =
            typeof metadata?.repositoryName === 'string'
                ? metadata.repositoryName
                : fallbackRepositoryName;

        const lineRangeRaw = metadata?.lineRange as
            | { start?: number; end?: number }
            | undefined;

        const description =
            typeof metadata?.description === 'string'
                ? metadata.description
                : undefined;

        const originalText =
            typeof metadata?.originalText === 'string'
                ? metadata.originalText
                : undefined;

        const detectedAt =
            typeof metadata?.detectedAt === 'string'
                ? new Date(metadata.detectedAt)
                : undefined;

        const lastValidatedAt =
            typeof metadata?.lastValidatedAt === 'string'
                ? new Date(metadata.lastValidatedAt)
                : detectedAt ?? new Date();

        const lastContentHash =
            typeof metadata?.lastContentHash === 'string'
                ? metadata.lastContentHash
                : '';

        const estimatedTokens =
            typeof metadata?.estimatedTokens === 'number'
                ? metadata.estimatedTokens
                : undefined;

        const lastFetchErrorRaw = metadata?.lastFetchError as
            | Record<string, unknown>
            | undefined;

        const lastFetchError = lastFetchErrorRaw
            ? this.mapDependencyError(lastFetchErrorRaw)
            : undefined;

        return {
            filePath,
            repositoryName,
            description,
            originalText,
            lineRange:
                lineRangeRaw?.start !== undefined &&
                lineRangeRaw?.end !== undefined
                    ? {
                          start: Number(lineRangeRaw.start),
                          end: Number(lineRangeRaw.end),
                      }
                    : undefined,
            lastContentHash,
            lastValidatedAt,
            estimatedTokens,
            lastFetchError,
        };
    }

    private mapDependencyError(
        error: Record<string, unknown>,
    ): IFileReference['lastFetchError'] | undefined {
        const type = error.type as PromptReferenceErrorType | undefined;
        if (!type) {
            return undefined;
        }

        const message =
            typeof error.message === 'string' ? error.message : '';
        const attemptedPatterns = Array.isArray(error.attemptedPatterns)
            ? (error.attemptedPatterns as string[])
            : [];
        const timestamp =
            typeof error.timestamp === 'string'
                ? new Date(error.timestamp)
                : new Date();

        return {
            type,
            message,
            attemptedPatterns,
            timestamp,
        };
    }

    private extractSyncErrorsFromRequirement(
        requirement: ContextRequirement,
    ): IPromptReferenceSyncError[] {
        const rawErrors = requirement.metadata?.syncErrors;
        if (!Array.isArray(rawErrors)) {
            return [];
        }

        return rawErrors
            .map((error) => this.toPromptReferenceSyncError(error))
            .filter(
                (error): error is IPromptReferenceSyncError =>
                    error !== undefined,
            );
    }

    private toPromptReferenceSyncError(
        raw: unknown,
    ): IPromptReferenceSyncError | undefined {
        if (!raw || typeof raw !== 'object') {
            return undefined;
        }

        const data = raw as NormalizedSyncError;
        if (!data.type || !data.message) {
            return undefined;
        }

        const details = data.details ?? {};

        return {
            type: data.type,
            message: data.message,
            details: {
                fileName: details.fileName,
                repositoryName: details.repositoryName,
                attemptedPaths: Array.isArray(details.attemptedPaths)
                    ? details.attemptedPaths
                    : undefined,
                timestamp: details.timestamp
                    ? new Date(details.timestamp)
                    : undefined,
            },
        };
    }

    private extractLastProcessedAt(
        requirement: ContextRequirement,
        revision: ContextReferenceEntity,
    ): Date | undefined {
        const metadata = requirement.metadata as Record<string, unknown> | undefined;
        if (metadata?.lastProcessedAt) {
            const raw = metadata.lastProcessedAt as string;
            if (typeof raw === 'string') {
                return new Date(raw);
            }
        }

        return revision.updatedAt ?? revision.createdAt ?? new Date();
    }
}
