import {
    CoreLayerBuilder,
    CatalogLayerBuilder,
    ActiveLayerBuilder,
    DefaultCoreMaterializer,
    DefaultCatalogMaterializer,
    DefaultActiveSelector,
    SequentialPackAssemblyPipeline,
    TriLayerPackBuilder,
    InMemoryMCPRegistry,
    MCPOrchestrator,
} from '../src/index.js';

import type {
    Candidate,
    ContextTelemetry,
    ContextMetrics,
    LayerInputContext,
    MCPClient,
    MCPInvocationRequest,
    MCPInvocationResult,
    RetrievalQuery,
    RuntimeContextSnapshot,
} from '../src/interfaces.js';

class ConsoleTelemetry implements ContextTelemetry {
    async record(event: Parameters<ContextTelemetry['record']>[0]): Promise<void> {
        // eslint-disable-next-line no-console
        console.log('[telemetry] event', event.type, {
            sessionId: event.sessionId,
            tokens: event.tokensUsed,
        });
    }

    async report(): Promise<ContextMetrics> {
        return {
            usageByDomain: {},
            avgTokensPerLayer: {},
            groundedness: { mean: 0, p95: 0 },
            driftAlerts: [],
        };
    }
}

class MockMCPClient implements MCPClient {
    async invoke(request: MCPInvocationRequest): Promise<MCPInvocationResult> {
        // eslint-disable-next-line no-console
        console.log('[mcp] invoking tool', request.tool.toolName, request.input);
        return {
            success: true,
            output: { echoedInput: request.input },
            latencyMs: 42,
        };
    }
}

async function runExample(): Promise<void> {
    const candidates: Candidate[] = [
        {
            item: {
                id: 'doc-1',
                domain: 'code',
                source: { type: 'repo', location: 'src/service.ts' },
                payload: {
                    text: 'Função processOrder atualiza estoque e cria log.',
                },
                metadata: {
                    version: 'v1',
                    title: 'Process Order Service',
                    tags: ['order', 'inventory'],
                    confidentiality: 'internal',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    lineage: [],
                },
            },
            score: 0.88,
            slices: [
                {
                    summary: 'processOrder chama updateInventory e createAuditLog.',
                    weight: 0.7,
                    metadata: { reason: 'diff-match' },
                },
            ],
        },
    ];

    const layerInput: LayerInputContext = {
        domain: 'code',
        taskIntent: 'review',
        retrieval: {
            candidates,
            diagnostics: {},
        },
        runtimeContext: {
            sessionId: 'session-123',
            threadId: 'thread-99',
            tenantId: 'tenant-abc',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            state: { phase: 'planning' },
            messages: [],
            knowledgeRefs: [],
            entities: {},
        } as RuntimeContextSnapshot,
        metadata: {},
    };

    const coreBuilder = new CoreLayerBuilder({
        materializer: new DefaultCoreMaterializer({
            baseInstructions: [
                {
                    id: 'style',
                    text: 'Siga o guia de revisão da equipe e cite arquivos relevantes.',
                    critical: true,
                },
            ],
        }),
    });

    const catalogBuilder = new CatalogLayerBuilder();
    const activeBuilder = new ActiveLayerBuilder({
        selector: new DefaultActiveSelector(),
    });

    const telemetry = new ConsoleTelemetry();

    const pipeline = new SequentialPackAssemblyPipeline({
        steps: [
            { builder: coreBuilder, description: 'Instruções base' },
            { builder: catalogBuilder, description: 'Resumo do PR' },
            { builder: activeBuilder, description: 'Snippets críticos' },
        ],
        telemetry: {
            client: telemetry,
        },
    });

    const packBuilder = new TriLayerPackBuilder({
        pipeline,
        budgetLimit: 6000,
        createdBy: 'context-os-example',
    });

    const query: RetrievalQuery = {
        domain: 'code',
        taskIntent: 'review',
        signal: { userMessage: 'Faça uma revisão rápida do PR 42' },
        constraints: { maxTokens: 6000 },
    };

    const pack = await packBuilder.buildPack({
        query,
        candidates,
    });

    pack.requiredTools = [
        {
            mcpId: 'demo',
            toolName: 'generate-checklist',
            description: 'Gera checklist de testes sugeridos baseado no contexto.',
        },
    ];

    const registry = new InMemoryMCPRegistry();
    registry.register({
        id: 'demo',
        title: 'Demo MCP',
        endpoint: 'http://localhost:3333/mcp',
        status: 'available',
        tools: pack.requiredTools ?? [],
    });

    const orchestrator = new MCPOrchestrator(
        registry,
        new MockMCPClient(),
        {
            telemetry: {
                client: telemetry,
            },
        },
    );

    await orchestrator.executeRequiredTools({
        pack,
        input: layerInput,
        runtime: layerInput.runtimeContext,
    });
}

// Executa o exemplo apenas se rodarmos este arquivo diretamente.
if (require.main === module) {
    runExample().catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
        process.exitCode = 1;
    });
}
