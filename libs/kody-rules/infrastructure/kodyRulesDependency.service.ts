import { Injectable } from '@nestjs/common';
import { ContextReferenceService } from '@libs/code-review/infrastructure/context/context-reference.service';
import { IKodyRule } from '@libs/kody-rules/domain/interfaces/kodyRules.interface';
import type { ContextDependency } from '@context-os-core/interfaces';

@Injectable()
export class KodyRuleDependencyService {
    constructor(
        private readonly contextReferenceService: ContextReferenceService,
    ) {}

    async getMcpDependenciesForRules(
        rules: Array<Partial<IKodyRule>>,
    ): Promise<ContextDependency[]> {
        const uniqueContextReferenceIds = [
            ...new Set(
                rules
                    .map((rule) => rule.contextReferenceId)
                    .filter((id): id is string => !!id),
            ),
        ];

        if (uniqueContextReferenceIds.length === 0) {
            return [];
        }

        const references = await Promise.all(
            uniqueContextReferenceIds.map((id) =>
                this.contextReferenceService.findById(id),
            ),
        );

        const uniqueDependencies = new Map<string, ContextDependency>();

        references.forEach((ref) => {
            if (!ref) {
                return;
            }

            const mcpDependencies = (ref.requirements ?? [])
                .flatMap((requirement) => requirement.dependencies ?? [])
                .filter((dep) => dep.type === 'mcp');

            mcpDependencies.forEach((dep) => {
                if (!uniqueDependencies.has(dep.id)) {
                    uniqueDependencies.set(dep.id, {
                        ...dep,
                        metadata: {
                            ...((dep.metadata ?? {}) as object),
                            contextReferenceId: ref.uuid,
                        },
                    });
                }
            });
        });

        return Array.from(uniqueDependencies.values());
    }
}
