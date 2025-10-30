import { existsSync } from 'node:fs';
import { createKnowledgeStore } from '../store/index.js';
import { ACEPipeline } from './pipeline.js';
import { ActionTelemetryRecorder } from '../../telemetry/action-logger.js';
import { pathToFileURL } from 'node:url';

async function main(): Promise<void> {
    const weaviateUrl = existsSync('/.dockerenv')
        ? 'http://weaviate:8080'
        : 'http://127.0.0.1:8080';

    const storeConfig = {
        type: 'weaviate' as const,
        options: {
            url: weaviateUrl,
            className: 'KnowledgeItem',
            grpcPort: 50051,
        },
    };

    const store = await createKnowledgeStore({ config: storeConfig });

    const pipeline = new ACEPipeline(store, {
        generator: {
            domain: 'code',
            intent: 'review',
        },
        curator: {
            domain: 'code',
            intent: 'review',
            author: 'lab-demo',
        },
        maxBullets: 50,
    });

    const startedAt = Date.now();
    const result = await pipeline.run([
        {
            id: 'trace-1',
            description: 'Executar checklist de regressão antes de aprovar PR crítico.',
            outcome: 'success',
            metadata: { rationale: 'Checklist evitou regressão em API de pagamentos.' },
        },
        {
            id: 'trace-2',
            description: 'Aprovação sem validar regra XYZ resultou em bug em produção.',
            outcome: 'failure',
        },
    ]);

    const recorder = new ActionTelemetryRecorder();
    await recorder.record({
        type: 'ACTION_COMPLETED',
        sessionId: 'ace-demo',
        tenantId: 'lab',
        timestamp: Date.now(),
        latencyMs: Date.now() - startedAt,
        metadata: {
            actionId: 'ace::pipeline-run',
            skills: result.map((entry) => entry.record.metadata?.title),
        },
    });

    // eslint-disable-next-line no-console
    console.log('Bullets gerados:', result.map((entry) => [entry.deltaType, entry.record.id]));

    await store.close();
}

const isMainModule = (): boolean => {
    const entry = process.argv[1];
    if (!entry) {
        return false;
    }
    return import.meta.url === pathToFileURL(entry).href;
};

if (isMainModule()) {
    main().catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
        process.exitCode = 1;
    });
}
