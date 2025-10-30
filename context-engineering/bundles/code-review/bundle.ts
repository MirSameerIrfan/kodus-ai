import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
    ActiveLayerBuilder,
    CatalogLayerBuilder,
    CoreLayerBuilder,
    DefaultActiveSelector,
    DefaultCatalogMaterializer,
    DefaultCoreMaterializer,
    SequentialPackAssemblyPipeline,
    TriLayerPackBuilder,
} from '../../../packages/context-os-core/src/index.js';

import type { CoreLayerInstruction } from '../../../packages/context-os-core/src/builders/core-layer-builder.js';

import type {
    Candidate,
    ContextDependency,
    ContextPackBuilder,
    DomainBundle,
    DomainSnapshot,
    ContextActionDescriptor,
    ContextResourceRef,
    RetrievalQuery,
} from '../../../packages/context-os-core/src/interfaces.js';

import { loadRulesForIntent } from '../../knowledge-fabric/selector.js';
import { loadSkillsFromDirectory } from '../../skills/loader.js';

const SNAPSHOT_PATH = path.resolve(
    process.cwd(),
    'context-engineering/bundles/code-review/snapshot.json',
);

async function loadSnapshot(): Promise<DomainSnapshot> {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf-8');
    return JSON.parse(raw) as DomainSnapshot;
}

export async function createCodeReviewLabBundle(): Promise<DomainBundle> {
    const snapshot = await loadSnapshot();

    const skillsDir = path.resolve(
        process.cwd(),
        'context-engineering/skills/examples',
    );
    const skillRegistry = await loadSkillsFromDirectory(skillsDir, {
        filter: (skill) => skill.metadata.domain === snapshot.domain,
    });
    const activeSkills = skillRegistry.list();

    const skillInstructions: CoreLayerInstruction[] = activeSkills.flatMap((skill) =>
        (skill.instructions ?? []).map((instruction) => ({
            id: `${skill.id}::${instruction.id}`,
            text: instruction.content,
            critical: instruction.role === 'system',
            metadata: {
                skillId: skill.id,
                role: instruction.role,
                scope: instruction.scope,
            },
        })),
    );

    const snapshotInstructions: CoreLayerInstruction[] =
        snapshot.promptOverrides?.map((override) => ({
            id: override.id,
            text: override.content,
            critical: override.role === 'system',
            metadata: {
                scope: override.scope,
                source: 'snapshot',
            },
        })) ?? [];

    const baseInstructions: CoreLayerInstruction[] = [
        ...snapshotInstructions,
        ...skillInstructions,
    ];

    const coreBuilder = new CoreLayerBuilder({
        materializer: new DefaultCoreMaterializer({
            persona: snapshot.config?.persona,
            baseInstructions,
        }),
    });

    const aggregatedActions = new Map<string, ContextActionDescriptor>();
    const aggregatedDependencies = new Map<string, ContextDependency>();
    const aggregatedResources = new Map<string, ContextResourceRef>();

    const mergeDependency = (
        dependency: ContextDependency,
        extraMetadata?: Record<string, unknown>,
    ) => {
        const metadata = {
            ...(dependency.metadata ?? {}),
            ...(extraMetadata ?? {}),
        };
        const key = `${dependency.type ?? 'unknown'}::${dependency.id}`;
        const existing = aggregatedDependencies.get(key);
        if (existing) {
            aggregatedDependencies.set(key, {
                ...existing,
                ...dependency,
                descriptor: dependency.descriptor ?? existing.descriptor,
                metadata: Object.keys(metadata).length
                    ? {
                          ...(existing.metadata ?? {}),
                          ...metadata,
                      }
                    : undefined,
            });
            return;
        }
        aggregatedDependencies.set(key, {
            ...dependency,
            metadata: Object.keys(metadata).length ? metadata : undefined,
        });
    };

    for (const action of snapshot.actions ?? []) {
        aggregatedActions.set(action.id, action);
    }

    for (const override of snapshot.promptOverrides ?? []) {
        for (const action of override.requiredActions ?? []) {
            aggregatedActions.set(action.id, action);
        }
        for (const dependency of override.dependencies ?? []) {
            mergeDependency(dependency);
        }
    }

    for (const skill of activeSkills) {
        for (const wrapper of skill.requiredActions ?? []) {
            const descriptor: ContextActionDescriptor = {
                ...wrapper.action,
                metadata: {
                    ...(wrapper.action.metadata ?? {}),
                    skillId: skill.id,
                    description: wrapper.description,
                },
            };
            aggregatedActions.set(descriptor.id, descriptor);
        }

        for (const dependency of skill.dependencies ?? []) {
            mergeDependency(dependency, { skillId: skill.id });
        }

        for (const resource of skill.resources ?? []) {
            aggregatedResources.set(resource.ref.id, {
                ...resource.ref,
                metadata: {
                    ...(resource.ref.metadata ?? {}),
                    skillId: skill.id,
                    attachLayer: resource.attachLayer,
                },
            });
        }
    }

    const catalogBuilder = new CatalogLayerBuilder({
        materializer: new DefaultCatalogMaterializer(),
    });

    const activeBuilder = new ActiveLayerBuilder({
        selector: new DefaultActiveSelector(),
    });

    const pipeline = new SequentialPackAssemblyPipeline({
        steps: [
            { builder: coreBuilder, description: 'Core layer (lab snapshot)' },
            { builder: catalogBuilder, description: 'Catalog layer (lab snapshot)' },
            { builder: activeBuilder, description: 'Active layer (lab snapshot)' },
        ],
    });

    const basePackBuilder = new TriLayerPackBuilder({
        pipeline,
        budgetLimit: 4096,
        createdBy: 'lab-context-os',
    });

    const packBuilder: ContextPackBuilder = {
        async buildPack(params) {
            const rules = await loadRulesForIntent({
                intent: params.query.taskIntent,
            });

            const mergedCandidates: Candidate[] = [
                ...rules,
                ...(params.candidates ?? []),
            ];

            const pack = await basePackBuilder.buildPack({
                ...params,
                candidates: mergedCandidates,
            });

            const actions = new Map(
                (pack.requiredActions ?? []).map((action) => [action.id, action]),
            );
            for (const [id, action] of aggregatedActions.entries()) {
                actions.set(id, action);
            }
            pack.requiredActions = Array.from(actions.values());

            const dependencies = new Map(
                (pack.dependencies ?? []).map((dependency) => [
                    `${dependency.type ?? 'unknown'}::${dependency.id}`,
                    dependency,
                ]),
            );
            for (const [key, dependency] of aggregatedDependencies.entries()) {
                const existing = dependencies.get(key);
                if (existing) {
                    dependencies.set(key, {
                        ...existing,
                        ...dependency,
                        descriptor: dependency.descriptor ?? existing.descriptor,
                        metadata: {
                            ...(existing.metadata ?? {}),
                            ...(dependency.metadata ?? {}),
                        },
                    });
                } else {
                    dependencies.set(key, dependency);
                }
            }
            pack.dependencies = Array.from(dependencies.values());

            const resources = new Map(
                (pack.resources ?? []).map((resource) => [resource.id, resource]),
            );
            for (const [id, resource] of aggregatedResources.entries()) {
                resources.set(id, resource);
            }
            pack.resources = Array.from(resources.values());

            pack.metadata = {
                ...(pack.metadata ?? {}),
                lab: true,
                knowledgeItemsInjected: rules.map((candidate) => candidate.item.id),
                skills: activeSkills.map((skill) => skill.id),
            };

            return pack;
        },
    };

    return {
        id: 'code-review-lab',
        domain: snapshot.domain,
        version: snapshot.version,
        snapshot,
        components: {
            builders: {
                core: coreBuilder,
                catalog: catalogBuilder,
                active: activeBuilder,
            },
            pipeline,
            packBuilder,
        },
    };
}

// Execução de demonstração
if (require.main === module) {
    (async () => {
        const bundle = await createCodeReviewLabBundle();
        const query: RetrievalQuery = {
            domain: 'code',
            taskIntent: 'review',
            signal: { userMessage: 'Revisar PR com regra XYZ' },
        };

        const pack = await bundle.components.packBuilder.buildPack({
            query,
            candidates: [],
        });

        // eslint-disable-next-line no-console
        console.log(
            'Camadas:',
            pack.layers.map((layer) => ({
                kind: layer.kind,
                tokens: layer.tokens,
            })),
        );
        // eslint-disable-next-line no-console
        console.log('Regras injetadas:', pack.metadata?.knowledgeItemsInjected);
        // eslint-disable-next-line no-console
        console.log('Skills ativas:', pack.metadata?.skills);
    })().catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
        process.exitCode = 1;
    });
}
