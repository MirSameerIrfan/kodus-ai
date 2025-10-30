#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import type { KnowledgeItem } from '../../packages/context-os-core/src/interfaces.js';
import { createKnowledgeStore } from './store/index.js';
import type { KnowledgeRecord } from './store/index.js';

async function ingestRule(filePath: string): Promise<void> {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absolutePath, 'utf-8');

    const id = `rule-${path.basename(filePath, path.extname(filePath))}`;
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    const item: KnowledgeRecord = {
        id,
        domain: 'code',
        source: {
            type: 'manual',
            location: filePath,
        },
        payload: {
            text: content.trim(),
        },
        metadata: {
            version: '1.0.0',
            title: `Regra ${id}`,
            tags: ['rule', 'code-review'],
            confidentiality: 'internal',
            ttlMs: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ownerId: 'context-engineering',
            lineage: [],
            checksum,
        },
    };

    const store = await createKnowledgeStore({
        config: { type: 'filesystem' },
    });
    await store.upsert(item);
    await store.close();

    // eslint-disable-next-line no-console
    console.log(`Regra ${id} ingerida no KnowledgeStore.`);
}

async function main(): Promise<void> {
    const [, , filePath] = process.argv;
    if (!filePath) {
        // eslint-disable-next-line no-console
        console.error('Uso: ts-node ingest-rule.ts <arquivo-regra>');
        process.exitCode = 1;
        return;
    }

    try {
        await ingestRule(filePath);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Falha ao ingerir regra:', error);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}
