import weaviate, {
    type WeaviateClient,
    type WeaviateField,
} from 'weaviate-client';
import { v5 as uuidv5, validate as validateUuid } from 'uuid';

import type {
    KnowledgeStore,
    KnowledgeRecord,
    KnowledgeFeedbackCounters,
    QueryFilters,
} from './types.js';
import type { FilterValue } from 'weaviate-client';

interface WeaviateStoreOptions {
    url: string;
    apiKey?: string;
    className?: string;
    grpcPort?: number;
}

const DEFAULT_CLASS_NAME = 'KnowledgeItem';
const DEFAULT_LIMIT = 25;
const DEFAULT_GRPC_PORT = 50051;
const UUID_NAMESPACE = uuidv5('kodus-context-os-knowledge-store', uuidv5.URL);

const COLLECTION_PROPERTIES = [
    'logicalId',
    'domain',
    'tags',
    'payloadText',
    'payloadStructured',
    'payloadAttachments',
    'confidentiality',
    'ttlMs',
    'createdAt',
    'updatedAt',
    'sourceType',
    'sourceLocation',
    'sourceAccessor',
    'title',
    'ownerId',
    'metadataVersion',
    'checksum',
    'feedbackHelpful',
    'feedbackHarmful',
    'feedbackLastHelpfulAt',
    'feedbackLastHarmfulAt',
    'lineage',
];

type CollectionInstance = ReturnType<WeaviateClient['collections']['use']>;
type PlainProperties = Record<string, WeaviateField>;

type JsonLike = Record<string, unknown> | Array<unknown>;

function cleanProperties(values: Record<string, unknown>): PlainProperties {
    return Object.fromEntries(
        Object.entries(values).filter(
            ([, value]) => value !== undefined && value !== null,
        ),
    ) as PlainProperties;
}

function parseJson<T>(value: string | undefined, fallback: T): T {
    if (!value) {
        return fallback;
    }

    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

export class WeaviateKnowledgeStore implements KnowledgeStore {
    private client!: WeaviateClient;
    private collectionRef?: CollectionInstance;
    private readonly className: string;

    constructor(private readonly options: WeaviateStoreOptions) {
        this.className = options.className ?? DEFAULT_CLASS_NAME;
    }

    async init(): Promise<void> {
        this.client = await this.createClient();
        await this.ensureCollection();
        this.collectionRef = this.client.collections.use(this.className);
    }

    async upsert(record: KnowledgeRecord): Promise<void> {
        const collection = this.collection();
        const now = Date.now();
        const createdAt = record.metadata.createdAt ?? now;
        const weaviateId = this.toWeaviateId(record.id);
        const properties = this.serializeRecord(record, {
            createdAt,
            updatedAt: now,
        });

        const exists = await collection.data.exists(weaviateId);
        if (exists) {
            await collection.data.replace({
                id: weaviateId,
                properties,
            });
            return;
        }

        await collection.data.insert({
            id: weaviateId,
            properties,
        });
    }

    async bulkUpsert(records: KnowledgeRecord[]): Promise<void> {
        for (const record of records) {
            // Sequential execution keeps the implementation simple and guarantees ordering.
            // Weaviate handles upserts quickly; if this becomes a bottleneck we can switch to insertMany with proper batching.
            // eslint-disable-next-line no-await-in-loop
            await this.upsert(record);
        }
    }

    async findById(id: string): Promise<KnowledgeRecord | undefined> {
        const collection = this.collection();
        const weaviateId = this.toWeaviateId(id);
        const result = await collection.query.fetchObjectById(weaviateId, {
            returnProperties: COLLECTION_PROPERTIES,
        });

        if (!result) {
            return undefined;
        }

        return this.deserializeRecord(
            id,
            result.properties as PlainProperties,
        );
    }

    async query(filters: QueryFilters = {}): Promise<KnowledgeRecord[]> {
        const collection = this.collection();
        const filterValue = this.buildFilters(collection, filters);
        const limit = filters.limit ?? DEFAULT_LIMIT;

        const options = {
            limit,
            filters: filterValue,
            returnProperties: COLLECTION_PROPERTIES,
        } as const;

        const result = filters.search
            ? await collection.query.hybrid(filters.search, options)
            : await collection.query.fetchObjects(options);

        return result.objects.map((obj) =>
            this.deserializeRecord(
                (obj.properties?.logicalId as string | undefined) ?? obj.uuid,
                obj.properties as PlainProperties,
            ),
        );
    }

    async appendLineage(
        id: string,
        lineage: KnowledgeRecord['metadata']['lineage'][number],
    ): Promise<void> {
        const existing = await this.findById(id);
        if (!existing) {
            throw new Error(`KnowledgeRecord ${id} not found`);
        }

        const nextLineage = [...(existing.metadata.lineage ?? []), lineage];
        await this.collection().data.update({
            id: this.toWeaviateId(id),
            properties: cleanProperties({
                lineage: JSON.stringify(nextLineage),
                updatedAt: Date.now(),
            }),
        });
    }

    async updateFeedback(
        id: string,
        delta: Partial<KnowledgeFeedbackCounters>,
    ): Promise<void> {
        const existing = await this.findById(id);
        if (!existing) {
            throw new Error(`KnowledgeRecord ${id} not found`);
        }

        const base = existing.feedback ?? { helpful: 0, harmful: 0 };
        const updated = {
            helpful: delta.helpful ?? base.helpful,
            harmful: delta.harmful ?? base.harmful,
            lastHelpfulAt: delta.lastHelpfulAt ?? base.lastHelpfulAt,
            lastHarmfulAt: delta.lastHarmfulAt ?? base.lastHarmfulAt,
        } satisfies KnowledgeFeedbackCounters;

        await this.collection().data.update({
            id: this.toWeaviateId(id),
            properties: cleanProperties({
                feedbackHelpful: updated.helpful,
                feedbackHarmful: updated.harmful,
                feedbackLastHelpfulAt: updated.lastHelpfulAt,
                feedbackLastHarmfulAt: updated.lastHarmfulAt,
                updatedAt: Date.now(),
            }),
        });
    }

    async close(): Promise<void> {
        if (this.client) {
            await this.client.close();
        }
    }

    private async createClient(): Promise<WeaviateClient> {
        const url = new URL(this.options.url);
        const apiKey = this.options.apiKey
            ? new weaviate.ApiKey(this.options.apiKey)
            : undefined;

        if (url.protocol === 'https:') {
            const endpoint = url.origin.replace(/\/$/, '');
            return await weaviate.connectToWeaviateCloud(endpoint, {
                authCredentials: apiKey,
            });
        }

        const host = url.hostname || 'localhost';
        const port = url.port ? Number(url.port) : undefined;
        const path =
            url.pathname && url.pathname !== '/' ? url.pathname : undefined;
        const grpcPort = this.options.grpcPort ?? DEFAULT_GRPC_PORT;
        const httpPort = port ?? 8080;

        // Prefer connectToLocal for straightforward localhost deployments without extra path.
        if (!path && (host === 'localhost' || host === '127.0.0.1')) {
            return await weaviate.connectToLocal({
                host,
                port: httpPort,
                grpcPort,
                authCredentials: apiKey,
            });
        }

        return await weaviate.connectToCustom({
            httpHost: host,
            httpPort,
            httpSecure: false,
            httpPath: path,
            grpcHost: host,
            grpcPort,
            grpcSecure: false,
            authCredentials: apiKey,
        });
    }

    private toWeaviateId(id: string): string {
        if (validateUuid(id)) {
            return id;
        }

        return uuidv5(id, UUID_NAMESPACE);
    }

    private async ensureCollection(): Promise<void> {
        const exists = await this.client.collections.exists(this.className);
        if (exists) {
            return;
        }

        await this.client.collections.create({
            name: this.className,
            vectorizers: weaviate.configure.vectorizer.none(),
            properties: [
                { name: 'logicalId', dataType: 'text' },
                { name: 'domain', dataType: 'text' },
                { name: 'tags', dataType: 'text[]' },
                { name: 'payloadText', dataType: 'text' },
                { name: 'payloadStructured', dataType: 'text' },
                { name: 'payloadAttachments', dataType: 'text[]' },
                { name: 'confidentiality', dataType: 'text' },
                { name: 'ttlMs', dataType: 'number' },
                { name: 'createdAt', dataType: 'number' },
                { name: 'updatedAt', dataType: 'number' },
                { name: 'sourceType', dataType: 'text' },
                { name: 'sourceLocation', dataType: 'text' },
                { name: 'sourceAccessor', dataType: 'text' },
                { name: 'title', dataType: 'text' },
                { name: 'ownerId', dataType: 'text' },
                { name: 'metadataVersion', dataType: 'text' },
                { name: 'checksum', dataType: 'text' },
                { name: 'feedbackHelpful', dataType: 'number' },
                { name: 'feedbackHarmful', dataType: 'number' },
                { name: 'feedbackLastHelpfulAt', dataType: 'number' },
                { name: 'feedbackLastHarmfulAt', dataType: 'number' },
                { name: 'lineage', dataType: 'text' },
            ],
        });
    }

    private collection(): CollectionInstance {
        if (!this.collectionRef) {
            this.collectionRef = this.client.collections.use(this.className);
        }
        return this.collectionRef;
    }

    private buildFilters(
        collection: CollectionInstance,
        filters: QueryFilters,
    ): FilterValue | undefined {
        const conditions: FilterValue[] = [];

        if (filters.domain) {
            conditions.push(
                collection.filter.byProperty('domain').equal(filters.domain),
            );
        }

        if (filters.tags?.length) {
            conditions.push(
                collection.filter.byProperty('tags').containsAny(filters.tags),
            );
        }

        if (!conditions.length) {
            return undefined;
        }

        if (conditions.length === 1) {
            return conditions[0];
        }

        return {
            operator: 'And',
            filters: conditions,
            value: null,
        } satisfies FilterValue;
    }

    private serializeRecord(
        record: KnowledgeRecord,
        overrides: { createdAt: number; updatedAt: number },
    ): PlainProperties {
        return cleanProperties({
            logicalId: record.id,
            domain: record.domain,
            tags:
                record.metadata.tags && record.metadata.tags.length
                    ? record.metadata.tags
                    : undefined,
            payloadText: record.payload.text ?? undefined,
            payloadStructured: record.payload.structured
                ? JSON.stringify(record.payload.structured)
                : undefined,
            payloadAttachments: record.payload.attachments?.length
                ? record.payload.attachments
                : undefined,
            confidentiality: record.metadata.confidentiality,
            ttlMs: record.metadata.ttlMs,
            createdAt: overrides.createdAt,
            updatedAt: overrides.updatedAt,
            sourceType: record.source.type,
            sourceLocation: record.source.location,
            sourceAccessor: record.source.accessor,
            title: record.metadata.title,
            ownerId: record.metadata.ownerId,
            metadataVersion: record.metadata.version,
            checksum: record.metadata.checksum,
            feedbackHelpful: record.feedback?.helpful ?? 0,
            feedbackHarmful: record.feedback?.harmful ?? 0,
            feedbackLastHelpfulAt: record.feedback?.lastHelpfulAt,
            feedbackLastHarmfulAt: record.feedback?.lastHarmfulAt,
            lineage: record.metadata.lineage?.length
                ? JSON.stringify(record.metadata.lineage)
                : undefined,
        });
    }

    private deserializeRecord(
        id: string,
        properties: PlainProperties,
    ): KnowledgeRecord {
        const logicalId =
            (properties.logicalId as string | undefined) ?? id ?? 'unknown';
        const createdAt =
            typeof properties.createdAt === 'number'
                ? properties.createdAt
                : Date.now();
        const updatedAt =
            typeof properties.updatedAt === 'number'
                ? properties.updatedAt
                : createdAt;

        const tags = Array.isArray(properties.tags)
            ? (properties.tags as string[])
            : [];
        const attachments = Array.isArray(properties.payloadAttachments)
            ? (properties.payloadAttachments as string[])
            : undefined;

        const payloadStructured = parseJson<JsonLike | undefined>(
            properties.payloadStructured as string | undefined,
            undefined,
        );

        const lineage = parseJson<KnowledgeRecord['metadata']['lineage']>(
            properties.lineage as string | undefined,
            [],
        );

        return {
            id: logicalId,
            domain: (properties.domain as string) ?? 'default',
            source: {
                type: (properties.sourceType as string) ?? 'unknown',
                location: (properties.sourceLocation as string) ?? '',
                accessor: properties.sourceAccessor as string | undefined,
            },
            payload: {
                text: properties.payloadText as string | undefined,
                structured: payloadStructured,
                attachments,
            },
            metadata: {
                version: (properties.metadataVersion as string) ?? '1.0.0',
                title: properties.title as string | undefined,
                tags,
                confidentiality:
                    (properties.confidentiality as KnowledgeRecord['metadata']['confidentiality']) ??
                    'internal',
                ttlMs: properties.ttlMs as number | undefined,
                createdAt,
                updatedAt,
                lineage,
                ownerId: properties.ownerId as string | undefined,
                checksum: properties.checksum as string | undefined,
            },
            feedback: {
                helpful:
                    (properties.feedbackHelpful as number | undefined) ?? 0,
                harmful:
                    (properties.feedbackHarmful as number | undefined) ?? 0,
                lastHelpfulAt: properties.feedbackLastHelpfulAt as
                    | number
                    | undefined,
                lastHarmfulAt: properties.feedbackLastHarmfulAt as
                    | number
                    | undefined,
            },
        };
    }
}
