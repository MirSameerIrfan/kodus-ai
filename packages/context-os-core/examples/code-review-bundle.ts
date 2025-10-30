import {
    ActiveLayerBuilder,
    CatalogLayerBuilder,
    CoreLayerBuilder,
    DefaultActiveSelector,
    DefaultCatalogMaterializer,
    DefaultCoreMaterializer,
    SequentialPackAssemblyPipeline,
    TriLayerPackBuilder,
} from '../src/index.js';

import type {
    Candidate,
    ContextActionDescriptor,
    ContextDependency,
    ContextPack,
    ContextPackBuilder,
    DeliveryRequest,
    DomainBundle,
    DomainSnapshot,
    LayerInputContext,
    MCPToolReference,
    PromptOverride,
    RetrievalQuery,
    RuntimeContextSnapshot,
} from '../src/interfaces.js';

interface CodeReviewSnapshotConfig {
    persona: {
        name: string;
        role: string;
        language: string;
    };
    v2PromptOverrides: Record<string, unknown>;
    severityFlags: Record<string, string>;
    requiredTools: MCPToolReference[];
    budgetLimit: number;
}

type CodeReviewSnapshot = DomainSnapshot<CodeReviewSnapshotConfig>;

const basePrompt = `You are Kody Bug-Hunter, a senior engineer specialized in identifying verifiable issues through mental code execution.
- Foque apenas nas linhas adicionadas.
- Anote problemas confirmados com severidade e categoria.`;

const promptOverrides: PromptOverride[] = [
    {
        id: 'bug-review-system',
        role: 'system',
        scope: 'core',
        content: basePrompt,
        dependencies: [
            {
                type: 'mcp',
                id: 'bugspec|fetch-bugspec',
                descriptor: { mcpId: 'bugspec', toolName: 'fetch-bugspec' },
            },
            {
                type: 'mcp',
                id: 'repo-insights|pull-pr-metadata',
                descriptor: {
                    mcpId: 'repo-insights',
                    toolName: 'pull-pr-metadata',
                },
            },
        ],
        requiredActions: [
            {
                id: 'load-bugspec',
                type: 'mcp',
                trigger: 'pre_delivery',
                mcpId: 'bugspec',
                toolName: 'fetch-bugspec',
                metadata: { attachLayer: 'catalog' },
            },
        ],
    },
];

const codeReviewSnapshot: CodeReviewSnapshot = {
    id: 'code-review::global',
    domain: 'code',
    version: '2025.01',
    createdAt: Date.now(),
    config: {
        persona: {
            name: 'Kody Bug-Hunter',
            role: 'Senior Bug Reviewer',
            language: 'pt-BR',
        },
        v2PromptOverrides: {
            bug: {
                generation: {
                    main: 'Detailed and verifiable issue description',
                },
                severity: {
                    flags: {
                        low: 'Minor performance overhead',
                        medium: 'Partially broken functionality',
                        high: 'Important functionality broken',
                        critical: 'Application crash/downtime',
                    },
                },
            },
        },
        severityFlags: {
            low: 'Minor performance overhead',
            medium: 'Partially broken functionality',
            high: 'Important functionality broken',
            critical: 'Application crash/downtime',
        },
        requiredTools: [
            { mcpId: 'bugspec', toolName: 'fetch-bugspec' },
            { mcpId: 'repo-insights', toolName: 'pull-pr-metadata' },
        ],
        budgetLimit: 6000,
    },
    promptOverrides,
    actions: [
        {
            id: 'load-pr-metadata',
            type: 'mcp',
            trigger: 'pre_core',
            mcpId: 'repo-insights',
            toolName: 'pull-pr-metadata',
            metadata: { attachLayer: 'catalog' },
        },
    ],
};

function createCodeReviewBundle(
    snapshot: CodeReviewSnapshot,
): DomainBundle<CodeReviewSnapshot> {
    const coreBuilder = new CoreLayerBuilder({
        materializer: new DefaultCoreMaterializer({
            persona: snapshot.config.persona,
            baseInstructions: snapshot.promptOverrides?.map((override) => ({
                id: override.id,
                text: override.content,
                critical: override.role === 'system',
                metadata: {
                    scope: override.scope,
                },
            })),
        }),
    });

    const catalogBuilder = new CatalogLayerBuilder({
        materializer: new DefaultCatalogMaterializer(),
    });

    const activeBuilder = new ActiveLayerBuilder({
        selector: new DefaultActiveSelector(),
    });

    const pipeline = new SequentialPackAssemblyPipeline({
        steps: [
            { builder: coreBuilder, description: 'Core layer (persona + policies)' },
            { builder: catalogBuilder, description: 'Catalog layer (summaries)' },
            { builder: activeBuilder, description: 'Active layer (snippets)' },
        ],
    });

    const basePackBuilder = new TriLayerPackBuilder({
        pipeline,
        budgetLimit: snapshot.config.budgetLimit,
        createdBy: 'context-os-code-review',
    });

    const aggregatedActions = new Map<string, ContextActionDescriptor>();
    const aggregatedDependencies = new Map<string, ContextDependency>();

    const upsertDependency = (dependency: ContextDependency) => {
        const key = `${dependency.type ?? 'unknown'}::${dependency.id}`;
        const existing = aggregatedDependencies.get(key);
        if (existing) {
            aggregatedDependencies.set(key, {
                ...existing,
                ...dependency,
                descriptor: dependency.descriptor ?? existing.descriptor,
                metadata: {
                    ...(existing.metadata ?? {}),
                    ...(dependency.metadata ?? {}),
                },
            });
            return;
        }
        aggregatedDependencies.set(key, dependency);
    };

    for (const action of snapshot.actions ?? []) {
        aggregatedActions.set(action.id, action);
    }

    for (const override of snapshot.promptOverrides ?? []) {
        for (const action of override.requiredActions ?? []) {
            aggregatedActions.set(action.id, action);
        }
        for (const dependency of override.dependencies ?? []) {
            upsertDependency(dependency);
        }
    }

    for (const tool of snapshot.config.requiredTools) {
        upsertDependency({
            type: 'mcp',
            id: `${tool.mcpId}|${tool.toolName}`,
            descriptor: tool,
            metadata: tool.metadata,
        });
    }

    const enrichedPackBuilder: ContextPackBuilder = {
        async buildPack(params) {
            const pack = await basePackBuilder.buildPack(params);

            if (aggregatedActions.size) {
                const existing = new Map(
                    (pack.requiredActions ?? []).map((action) => [action.id, action]),
                );

                for (const [id, action] of aggregatedActions.entries()) {
                    existing.set(id, action);
                }

                pack.requiredActions = Array.from(existing.values());
            }

            if (aggregatedDependencies.size) {
                const existing = new Map(
                    (pack.dependencies ?? []).map((dependency) => [
                        `${dependency.type ?? 'unknown'}::${dependency.id}`,
                        dependency,
                    ]),
                );

                for (const [key, dependency] of aggregatedDependencies.entries()) {
                    const current = existing.get(key);
                    if (current) {
                        existing.set(key, {
                            ...current,
                            ...dependency,
                            descriptor: dependency.descriptor ?? current.descriptor,
                            metadata: {
                                ...(current.metadata ?? {}),
                                ...(dependency.metadata ?? {}),
                            },
                        });
                    } else {
                        existing.set(key, dependency);
                    }
                }

                pack.dependencies = Array.from(existing.values());
            }

            pack.metadata = {
                ...(pack.metadata ?? {}),
                bundleId: 'code-review',
            };

            return pack;
        },
    };

    return {
        id: 'code-review',
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
            packBuilder: enrichedPackBuilder,
            actions: Array.from(aggregatedActions.values()),
            dependencies: Array.from(aggregatedDependencies.values()),
            deliveryAdapter: {
                buildPayload(
                    pack: ContextPack,
                    runtime: RuntimeContextSnapshot,
                    request: DeliveryRequest,
                ) {
                    const systemMessage =
                        snapshot.promptOverrides?.find(
                            (override) =>
                                override.scope === 'core' &&
                                override.role === 'system',
                        )?.content ?? '';

                    const userMessage =
                        request.userIntent ??
                        runtime.messages[runtime.messages.length - 1]?.content ??
                        'Analise o pull request informado.';

                    return {
                        systemMessage,
                        userMessage: String(userMessage),
                        toolSchemas: request.toolset?.map((tool) => tool.schema),
                        attachments: [],
                        onDemandResources: pack.resources ?? [],
                        diagnostics: {
                            dependencies: pack.dependencies
                                ?.filter((dependency) => dependency.type === 'mcp')
                                ?.map((dependency) => dependency.id),
                        },
                    };
                },
                async deliver(payload) {
                    // eslint-disable-next-line no-console
                    console.log('[delivery] system prompt:\n', payload.systemMessage);
                    // eslint-disable-next-line no-console
                    console.log('[delivery] user prompt:\n', payload.userMessage);
                    return payload;
                },
            },
            metadata: {
                persona: snapshot.config.persona.name,
            },
        },
        metadata: {
            description: 'Domain bundle connecting snapshot prompts to MCP actions.',
        },
    };
}

async function runBundleExample(): Promise<void> {
    const bundle = createCodeReviewBundle(codeReviewSnapshot);

    const candidates: Candidate[] = [
        {
            item: {
                id: 'component.ts',
                domain: 'code',
                source: { type: 'repo', location: 'src/component.ts' },
                payload: {
                    text: 'export function Component() { return null; }',
                },
                metadata: {
                    version: '1.0.0',
                    confidentiality: 'internal',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    lineage: [],
                    tags: ['component', 'ui'],
                },
            },
            score: 0.92,
            slices: [
                {
                    summary: 'Componente principal renderiza null.',
                    weight: 0.8,
                },
            ],
        },
    ];

    const query: RetrievalQuery = {
        domain: 'code',
        taskIntent: 'review',
        signal: { userMessage: 'Faça a revisão do PR #42' },
        constraints: { maxTokens: 4096 },
    };

    const pack = await bundle.components.packBuilder.buildPack({
        query,
        candidates,
    });

    // eslint-disable-next-line no-console
    console.log('ContextPack layers:', pack.layers.map((layer) => layer.kind));
    // eslint-disable-next-line no-console
    console.log(
        'Declared dependencies:',
        pack.dependencies?.map((dependency) => dependency.id),
    );

    const runtime: RuntimeContextSnapshot = {
        sessionId: 'session-1',
        threadId: 'thread-1',
        tenantId: 'tenant-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: { phase: 'planning' },
        messages: [
            {
                id: 'msg-1',
                role: 'user',
                content: 'Quero um review detalhado.',
                timestamp: Date.now(),
            },
        ],
        knowledgeRefs: [],
        entities: {},
    };

    const deliveryRequest: DeliveryRequest = {
        userIntent: query.signal.userMessage ?? 'Revisar código',
        agentIdentity: bundle.snapshot.config.persona,
        toolset: [],
    };

    const payload = bundle.components.deliveryAdapter?.buildPayload(
        pack,
        runtime,
        deliveryRequest,
    );

    if (payload && bundle.components.deliveryAdapter) {
        await bundle.components.deliveryAdapter.deliver(payload);
    }
}

if (require.main === module) {
    runBundleExample().catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
        process.exitCode = 1;
    });
}
