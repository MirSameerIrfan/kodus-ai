import weaviate, { ApiKey } from 'weaviate-ts-client';

import type { KnowledgeStore, KnowledgeRecord, QueryFilters, KnowledgeFeedbackCounters } from './types.js';

interface WeaviateStoreOptions {
    url: string;
    apiKey?: string;
    className?: string;
}

const DEFAULT_CLASS_NAME = 'KnowledgeItem';

function buildWhereFilter(filters: QueryFilters | undefined): Record<string, unknown> | undefined {
    if (!filters) {
        return undefined;
    }

    const operands: Record<string, unknown>[] = [];

    if (filters.domain) {
        operands.push({
            path: ['domain'],
            operator: 'Equal',
            valueText: filters.domain,
        });
    }

    if (filters.tags?.length) {
        operands.push({
            path: ['tags'],
            operator: 'ContainsAny',
            valueStringArray: filters.tags,
        });
    }

    if (!operands.length) {
        return undefined;
    }

    if (operands.length === 1) {
        return operands[0];
    }

    return {
        operator: 'And',
        operands,
    };
}

export class WeaviateKnowledgeStore implements KnowledgeStore {
    private readonly className: string;
    private client!: ReturnType<typeof weaviate.client>;

    constructor(private readonly options: WeaviateStoreOptions) {
        this.className = options.className ?? DEFAULT_CLASS_NAME;
    }

    async init(): Promise<void> {
        const url = new URL(this.options.url);
        this.client = weaviate.client({
            scheme: url.protocol.replace(':', ''),
            host: url.host,
            apiKey: this.options.apiKey ? new ApiKey(this.options.apiKey) : undefined,
        });

        await this.ensureSchema();
    }

    async upsert(record: KnowledgeRecord): Promise<void> {
        await this.client.data
            .upsert({
                class: this.className,
                id: record.id,
                properties: this.toProperties(record),
                vector: undefined, // vectorIndexType none
            })
            .do();
    }

    async bulkUpsert(records: KnowledgeRecord[]): Promise<void> {
        for (const record of records) {
            await this.upsert(record);
        }
    }

    async findById(id: string): Promise<KnowledgeRecord | undefined> {
        try {
            const response = await this.client.data
                .getterById()
                .withClassName(this.className)
                .withId(id)
                .do();
            return response ? this.fromProperties(id, response.properties) : undefined;
        } catch {
            return undefined;
        }
    }

    async query(filters: QueryFilters = {}): Promise<KnowledgeRecord[]> {
        const whereFilter = buildWhereFilter(filters);

        const builder = this.client.graphql
            .get()
            .withClassName(this.className)
            .withFields('id domain tags payload metadata feedback createdAt updatedAt')
            .withLimit(filters.limit ?? 100);

        if (whereFilter) {
            builder.withWhere(whereFilter);
        }

        const response = await builder.do();
        const results = response.data?.Get?.[this.className] ?? [];

        const records = results.map((item: Record<string, unknown>) =>
            this.fromProperties(item.id as string, item),
        );

        if (filters.search) {
            const term = filters.search.toLowerCase();
            return records.filter((record) => {
                const text = `${record.metadata.title ?? ''} ${record.payload.text ?? ''}`.toLowerCase();
                return text.includes(term);
            });
        }

        return records;
    }

    async appendLineage(id: string, lineage: KnowledgeRecord['metadata']['lineage'][number]): Promise<void> {
        const record = await this.findById(id);
        if (!record) {
            throw new Error(`KnowledgeRecord ${id} not found`);
        }

        record.metadata.lineage = [...(record.metadata.lineage ?? []), lineage];
        record.metadata.updatedAt = Date.now();

        await this.upsert(record);
    }

    async updateFeedback(id: string, delta: Partial<KnowledgeFeedbackCounters>): Promise<void> {
        const record = await this.findById(id);
        if (!record) {
            throw new Error(`KnowledgeRecord ${id} not found`);
        }

        const feedback = record.feedback ?? { helpful: 0, harmful: 0 };

        record.feedback = {
            helpful: delta.helpful ?? feedback.helpful,
            harmful: delta.harmful ?? feedback.harmful,
            lastHelpfulAt: delta.lastHelpfulAt ?? feedback.lastHelpfulAt,
            lastHarmfulAt: delta.lastHarmfulAt ?? feedback.lastHarmfulAt,
        };

        await this.upsert(record);
    }

    async close(): Promise<void> {
        // no-op for Weaviate client
    }

    private toProperties(record: KnowledgeRecord): Record<string, unknown> {
        return {
            domain: record.domain,
            tags: record.metadata.tags ?? [],
            payload: JSON.stringify(record.payload ?? {}),
            metadata: JSON.stringify(record.metadata ?? {}),
            feedback: JSON.stringify(record.feedback ?? { helpful: 0, harmful: 0 }),
            createdAt: record.metadata.createdAt ?? Date.now(),
            updatedAt: Date.now(),
        };
    }

    private fromProperties(id: string, properties: Record<string, unknown>): KnowledgeRecord {
        const metadataRaw = typeof properties.metadata === 'string' ? properties.metadata : '{}';
        const payloadRaw = typeof properties.payload === 'string' ? properties.payload : '{}';
        const feedbackRaw = typeof properties.feedback === 'string' ? properties.feedback : '{}';

        const metadata = JSON.parse(metadataRaw) as KnowledgeRecord['metadata'];
        const payload = JSON.parse(payloadRaw) as KnowledgeRecord['payload'];
        const feedback = JSON.parse(feedbackRaw) as KnowledgeFeedbackCounters;

        return {
            id,
            domain: (properties.domain as string) ?? 'default',
            source: metadata?.source ?? { type: 'unknown', location: '' },
            payload,
            metadata: {
                ...metadata,
                tags: metadata?.tags ?? (properties.tags as string[]) ?? [],
                createdAt: metadata?.createdAt ?? (properties.createdAt as number) ?? Date.now(),
                updatedAt: metadata?.updatedAt ?? (properties.updatedAt as number) ?? Date.now(),
                lineage: metadata?.lineage ?? [],
            },
            feedback,
        };
    }

    private async ensureSchema(): Promise<void> {
        const schema = await this.client.schema.getter().do();
        const exists = schema.classes?.some((cls) => cls.class === this.className);

        if (exists) {
            return;
        }

        await this.client.schema
            .classCreator()
            .withClass({
                class: this.className,
                vectorizer: 'none',
                vectorIndexType: 'none',
                properties: [
                    { name: 'domain', dataType: ['text'] },
                    { name: 'tags', dataType: ['text[]'] },
                    { name: 'payload', dataType: ['text'] },
                    { name: 'metadata', dataType: ['text'] },
                    { name: 'feedback', dataType: ['text'] },
                    { name: 'createdAt', dataType: ['number'] },
                    { name: 'updatedAt', dataType: ['number'] },
                ],
            })
            .do();
    }
}
