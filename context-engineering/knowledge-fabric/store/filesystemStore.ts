import { promises as fs } from 'node:fs';
import path from 'node:path';

import type {
    KnowledgeRecord,
    KnowledgeStore,
    KnowledgeFeedbackCounters,
    QueryFilters,
} from './types.js';

interface Snapshot {
    items: Record<string, KnowledgeRecord>;
    updatedAt: number;
}

const DEFAULT_SNAPSHOT: Snapshot = {
    items: {},
    updatedAt: 0,
};

function matchesFilters(record: KnowledgeRecord, filters?: QueryFilters): boolean {
    if (!filters) {
        return true;
    }

    if (filters.domain && record.domain !== filters.domain) {
        return false;
    }

    if (filters.tags?.length) {
        const tags = record.metadata.tags ?? [];
        if (!filters.tags.every((tag) => tags.includes(tag))) {
            return false;
        }
    }

    if (filters.search) {
        const target = `${record.metadata.title ?? ''} ${record.payload.text ?? ''}`.toLowerCase();
        if (!target.includes(filters.search.toLowerCase())) {
            return false;
        }
    }

    return true;
}

export class FilesystemKnowledgeStore implements KnowledgeStore {
    private snapshot: Snapshot = DEFAULT_SNAPSHOT;

    constructor(private readonly filePath: string) {}

    async init(): Promise<void> {
        try {
            const raw = await fs.readFile(this.filePath, 'utf-8');
            const data = JSON.parse(raw) as Snapshot;
            this.snapshot = {
                items: data.items ?? {},
                updatedAt: data.updatedAt ?? Date.now(),
            };
        } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
                await this.persist();
                return;
            }
            throw error;
        }
    }

    async upsert(record: KnowledgeRecord): Promise<void> {
        this.snapshot.items[record.id] = this.prepareRecord(record);
        await this.persist();
    }

    async bulkUpsert(records: KnowledgeRecord[]): Promise<void> {
        for (const record of records) {
            this.snapshot.items[record.id] = this.prepareRecord(record);
        }
        await this.persist();
    }

    async findById(id: string): Promise<KnowledgeRecord | undefined> {
        return this.snapshot.items[id];
    }

    async query(filters: QueryFilters = {}): Promise<KnowledgeRecord[]> {
        const records = Object.values(this.snapshot.items).filter((record) =>
            matchesFilters(record, filters),
        );

        if (filters.limit) {
            return records.slice(0, filters.limit);
        }

        return records;
    }

    async appendLineage(
        id: string,
        lineage: KnowledgeRecord['metadata']['lineage'][number],
    ): Promise<void> {
        const existing = this.snapshot.items[id];
        if (!existing) {
            throw new Error(`KnowledgeRecord ${id} not found`);
        }

        existing.metadata.lineage = [...(existing.metadata.lineage ?? []), lineage];
        existing.metadata.updatedAt = Date.now();
        await this.persist();
    }

    async updateFeedback(
        id: string,
        delta: Partial<KnowledgeFeedbackCounters>,
    ): Promise<void> {
        const existing = this.snapshot.items[id];
        if (!existing) {
            throw new Error(`KnowledgeRecord ${id} not found`);
        }

        const base = existing.feedback ?? {
            helpful: 0,
            harmful: 0,
        };

        existing.feedback = {
            helpful: delta.helpful !== undefined ? delta.helpful : base.helpful,
            harmful: delta.harmful !== undefined ? delta.harmful : base.harmful,
            lastHelpfulAt:
                delta.lastHelpfulAt !== undefined ? delta.lastHelpfulAt : base.lastHelpfulAt,
            lastHarmfulAt:
                delta.lastHarmfulAt !== undefined ? delta.lastHarmfulAt : base.lastHarmfulAt,
        };

        await this.persist();
    }

    async close(): Promise<void> {
        await this.persist();
    }

    private async persist(): Promise<void> {
        const payload = JSON.stringify(
            {
                ...this.snapshot,
                updatedAt: Date.now(),
            },
            null,
            2,
        );
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(this.filePath, payload, 'utf-8');
    }

    private prepareRecord(record: KnowledgeRecord): KnowledgeRecord {
        return {
            ...record,
            metadata: {
                ...record.metadata,
                createdAt: record.metadata.createdAt ?? Date.now(),
                updatedAt: Date.now(),
                lineage: record.metadata.lineage ?? [],
            },
            feedback: record.feedback ?? {
                helpful: 0,
                harmful: 0,
            },
        };
    }
}

export function createFilesystemStore(filePath?: string): FilesystemKnowledgeStore {
    const resolvedPath =
        filePath ??
        path.resolve(process.cwd(), 'context-engineering/knowledge-fabric/store.json');
    return new FilesystemKnowledgeStore(resolvedPath);
}
