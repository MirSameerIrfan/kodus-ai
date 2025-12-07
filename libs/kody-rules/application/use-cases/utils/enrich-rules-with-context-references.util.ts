import type { IContextReferenceService } from '@libs/code-review/domain/context/contracts/context-reference.service.contract';
import type { ContextReferenceEntity } from '@libs/code-review/domain/context/entities/context-reference.entity';
import { SimpleLogger } from '@kodus/flow/dist/observability/logger';

type RuleWithContextId = {
    uuid?: string;
    contextReferenceId?: string;
};

type EnrichedFields = {
    referenceProcessingStatus: string | null;
    lastReferenceProcessedAt?: Date;
    externalReferences: Array<{
        filePath?: string;
        description?: string;
        originalText?: string;
        repositoryName?: string;
        lastValidatedAt?: Date;
    }>;
    syncErrors: any[];
};

export async function enrichRulesWithContextReferences<
    T extends RuleWithContextId,
>(
    rules: T[],
    contextReferenceService: IContextReferenceService,
    logger: SimpleLogger,
): Promise<Array<T & EnrichedFields>> {
    return await Promise.all(
        (rules || []).map(async (rule) => {
            if (!rule.contextReferenceId) {
                return {
                    ...rule,
                    referenceProcessingStatus: null,
                    externalReferences: [],
                    syncErrors: [],
                };
            }

            try {
                const contextRef = await contextReferenceService.findById(
                    rule.contextReferenceId,
                );

                if (!contextRef) {
                    return {
                        ...rule,
                        referenceProcessingStatus: 'pending',
                        externalReferences: [],
                        syncErrors: [],
                    };
                }

                const externalReferences =
                    extractExternalReferences(contextRef);
                const syncErrors = extractSyncErrors(contextRef);

                return {
                    ...rule,
                    referenceProcessingStatus: contextRef.processingStatus,
                    lastReferenceProcessedAt: contextRef.lastProcessedAt,
                    externalReferences,
                    syncErrors,
                };
            } catch (error) {
                logger.warn({
                    message:
                        'Failed to fetch context reference for kody rule while enriching response',
                    context: 'enrichRulesWithContextReferences',
                    error,
                    metadata: {
                        ruleUuid: rule.uuid,
                        contextReferenceId: rule.contextReferenceId,
                    },
                });

                return {
                    ...rule,
                    referenceProcessingStatus: 'failed',
                    externalReferences: [],
                    syncErrors: [],
                };
            }
        }),
    );
}

function extractExternalReferences(
    contextRef: ContextReferenceEntity,
): EnrichedFields['externalReferences'] {
    const references: EnrichedFields['externalReferences'] = [];
    const requirements = contextRef.requirements || [];

    for (const requirement of requirements) {
        const dependencies = requirement.dependencies || [];

        for (const dep of dependencies) {
            if (dep.type === 'knowledge' && dep.metadata) {
                references.push({
                    filePath: dep.metadata.filePath as string | undefined,
                    description: dep.metadata.description as string | undefined,
                    originalText: dep.metadata.originalText as
                        | string
                        | undefined,
                    repositoryName: dep.metadata.repositoryName as
                        | string
                        | undefined,
                    lastValidatedAt:
                        dep.metadata.detectedAt != null
                            ? new Date(dep.metadata.detectedAt as string)
                            : undefined,
                });
            }
        }
    }

    return references;
}

function extractSyncErrors(contextRef: ContextReferenceEntity): any[] {
    const errors: any[] = [];
    const requirements = contextRef.requirements || [];

    for (const requirement of requirements) {
        const syncErrors = (requirement.metadata as any)?.syncErrors || [];
        errors.push(...syncErrors);
    }

    return errors;
}
