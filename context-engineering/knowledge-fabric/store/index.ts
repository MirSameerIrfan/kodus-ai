import type { KnowledgeStore, KnowledgeStoreConfig } from './types.js';
import { createFilesystemStore } from './filesystemStore.js';
import { WeaviateKnowledgeStore } from './weaviateStore.js';

export type { KnowledgeRecord, KnowledgeStore, KnowledgeStoreConfig } from './types.js';

export interface StoreFactoryOptions {
    config?: KnowledgeStoreConfig;
}

export async function createKnowledgeStore(
    options: StoreFactoryOptions = {},
): Promise<KnowledgeStore> {
    const config = options.config ?? {
        type: 'filesystem',
    };

    switch (config.type) {
        case 'filesystem': {
            const store = createFilesystemStore(
                config.options?.filePath ?? undefined,
            );
            await store.init();
            return store;
        }
        case 'weaviate': {
            const store = new WeaviateKnowledgeStore({
                url: config.options.url,
                apiKey: config.options.apiKey,
                className: config.options.className,
            });
            await store.init();
            return store;
        }
        case 'postgres':
            throw new Error(
                'Postgres store não implementado no laboratório. Forneça driver em produção.',
            );
        case 'chroma':
            throw new Error(
                'Chroma store não implementado no laboratório. Integre com SDK oficial em produção.',
            );
        default:
            throw new Error(`Tipo de store desconhecido: ${(config as KnowledgeStoreConfig).type}`);
    }
}
