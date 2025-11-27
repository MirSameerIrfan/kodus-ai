import {
    BaseStorage,
    BaseStorageItem,
    BaseStorageStats,
    StorageAdapterConfig,
} from '../../../core/types/allTypes.js';
import { createLogger } from '../../../observability/logger.js';

import type { MongoClient, Db, Collection } from 'mongodb';

const logger = createLogger('mongodb-storage-adapter');

export class MongoDBStorageAdapter<T extends BaseStorageItem>
    implements BaseStorage<T>
{
    private config: StorageAdapterConfig;
    private isInitialized = false;
    private client: MongoClient | null = null;
    private db: Db | null = null;
    private collection: Collection | null = null;

    constructor(config: StorageAdapterConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            const { MongoClient: mongoClient } = await import('mongodb');

            const connectionString =
                this.config.connectionString ||
                'mongodb://localhost:27017/kodus';
            const options = this.config.options || {};

            this.client = new mongoClient(connectionString, {
                maxPoolSize: (options.maxPoolSize as number) ?? 10,
                serverSelectionTimeoutMS:
                    (options.serverSelectionTimeoutMS as number) ?? 5000,
                connectTimeoutMS: (options.connectTimeoutMS as number) ?? 10000,
                socketTimeoutMS: (options.socketTimeoutMS as number) ?? 45000,
            });

            await this.client.connect();

            const database = (options.database as string) ?? 'kodus';

            const defaultCollection =
                (options.collection as string) ?? 'storage';
            const dataType = this.determineDataType();
            const collection = this.getCollectionName(
                defaultCollection,
                dataType,
            );

            this.db = this.client.db(database);
            this.collection = this.db.collection(collection);

            // Create indexes for performance
            await (
                this.collection as {
                    createIndex: (
                        index: unknown,
                        options?: unknown,
                    ) => Promise<unknown>;
                }
            ).createIndex({ id: 1 }, { unique: true });
            await (
                this.collection as {
                    createIndex: (
                        index: unknown,
                        options?: unknown,
                    ) => Promise<unknown>;
                }
            ).createIndex({ timestamp: 1 });
            await (
                this.collection as {
                    createIndex: (
                        index: unknown,
                        options?: unknown,
                    ) => Promise<unknown>;
                }
            ).createIndex({ [String('metadata.xcId')]: 1 } as {
                [key: string]: number;
            });

            if (options.ttl) {
                await (
                    this.collection as {
                        createIndex: (
                            index: unknown,
                            options?: unknown,
                        ) => Promise<unknown>;
                    }
                ).createIndex(
                    { createdAt: 1 },
                    { expireAfterSeconds: options.ttl },
                );
            }

            this.isInitialized = true;
            logger.log({
                message: 'MongoDBStorageAdapter initialized',
                context: 'initialize',

                metadata: {
                    database,
                    collection,
                    dataType,
                    maxItems: this.config.maxItems,
                    enableCompression: this.config.enableCompression,
                    timeout: this.config.timeout,
                },
            });
        } catch (error) {
            logger.error({
                message: 'Failed to initialize MongoDB adapter',
                context: 'initialize',
                error: error as Error,
            });
            throw error;
        }
    }

    private determineDataType(): string {
        return 'storage';
    }

    private getCollectionName(
        defaultCollection: string,
        dataType: string,
    ): string {
        if (defaultCollection.startsWith('kodus-')) {
            return defaultCollection;
        }

        switch (dataType) {
            case 'snapshots':
                return 'kodus-snapshots';
            case 'memory':
                return 'kodus-memory';
            case 'sessions':
                return 'kodus-sessions';
            case 'state':
                return 'kodus-state';
            default:
                return `kodus-${defaultCollection}`;
        }
    }

    async store(item: T): Promise<void> {
        await this.ensureInitialized();

        try {
            if (!this.collection) {
                throw new Error('Collection not initialized');
            }

            const document = {
                ...item,
                createdAt: new Date(),
            };

            await this.collection.replaceOne({ id: item.id }, document, {
                upsert: true,
            });

            logger.debug({
                message: 'Item stored in MongoDB',
                context: 'store',

                metadata: {
                    id: item.id,
                    timestamp: item.timestamp,
                    collection: this.collection.collectionName,
                },
            });
        } catch (error) {
            logger.error({
                message: 'Failed to store item in MongoDB',
                context: 'store',
                error: error as Error,

                metadata: {
                    id: item.id,
                    collection: this.collection?.collectionName,
                },
            });
            throw error;
        }
    }

    async retrieve(id: string): Promise<T | null> {
        await this.ensureInitialized();

        try {
            const document = await this.collection!.findOne({ id });

            if (!document) {
                return null;
            }

            return document as unknown as T;
        } catch (error) {
            logger.error({
                message: 'Failed to retrieve item from MongoDB',
                context: 'retrieve',
                error: error as Error,

                metadata: {
                    id,
                    collection: this.collection?.collectionName,
                },
            });
            throw error;
        }
    }

    async delete(id: string): Promise<boolean> {
        await this.ensureInitialized();

        try {
            const result = await this.collection!.deleteOne({ id });

            logger.debug({
                message: 'Item deleted from MongoDB',
                context: 'delete',

                metadata: {
                    id,
                    deletedCount: result.deletedCount,
                    collection: this.collection?.collectionName,
                },
            });

            return result.deletedCount > 0;
        } catch (error) {
            logger.error({
                message: 'Failed to delete item from MongoDB',
                context: 'delete',
                error: error as Error,

                metadata: {
                    id,
                    collection: this.collection?.collectionName,
                },
            });
            throw error;
        }
    }

    async clear(): Promise<void> {
        await this.ensureInitialized();

        try {
            await this.collection!.deleteMany({});

            logger.log({
                message: 'Collection cleared',
                context: 'clear',

                metadata: {
                    collection: this.collection?.collectionName,
                },
            });
        } catch (error) {
            logger.error({
                message: 'Failed to clear collection',
                context: 'clear',
                error: error as Error,

                metadata: {
                    collection: this.collection?.collectionName,
                },
            });
            throw error;
        }
    }

    async getStats(): Promise<BaseStorageStats> {
        await this.ensureInitialized();

        try {
            const count = await this.collection!.countDocuments();
            const stats = await this.collection!.aggregate([
                {
                    $group: {
                        _id: null, // eslint-disable-line @typescript-eslint/naming-convention
                        totalSize: { $sum: { $bsonSize: '$$ROOT' } },
                        avgSize: { $avg: { $bsonSize: '$$ROOT' } },
                    },
                },
            ]).toArray();

            const result = stats[0] || { totalSize: 0, avgSize: 0 };

            return {
                itemCount: count,
                totalSize: result.totalSize,
                averageItemSize: Math.round(result.avgSize),
                adapterType: 'mongodb',
            };
        } catch (error) {
            logger.error({
                message: 'Failed to get stats from MongoDB',
                context: 'getStats',
                error: error as Error,

                metadata: {
                    collection: this.collection?.collectionName,
                },
            });
            throw error;
        }
    }

    async isHealthy(): Promise<boolean> {
        try {
            if (!this.client) {
                return false;
            }

            // Ping the database
            await this.client.db().admin().ping();
            return true;
        } catch (error) {
            logger.error({
                message: 'Health check failed',
                context: 'isHealthy',
                error: error as Error,
            });
            return false;
        }
    }

    async cleanup(): Promise<void> {
        try {
            if (this.client) {
                await this.client.close();
                this.client = null;
                this.db = null;
                this.collection = null;
                this.isInitialized = false;

                logger.log({
                    message: 'MongoDB adapter cleaned up',
                    context: 'cleanup',
                });
            }
        } catch (error) {
            logger.error({
                message: 'Failed to cleanup MongoDB adapter',
                context: 'cleanup',
                error: error as Error,
            });
            throw error;
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    /**
     * Find one document by arbitrary query (used by higher-level adapters when needed)
     */
    async findOneByQuery(query: Record<string, unknown>): Promise<T | null> {
        await this.ensureInitialized();
        try {
            const doc = await this.collection!.findOne(
                query as unknown as object,
            );
            return (doc as unknown as T) || null;
        } catch (error) {
            logger.error({
                message: 'Failed to execute findOneByQuery',
                context: 'findOneByQuery',
                error: error as Error,

                metadata: {
                    query,
                },
            });
            return null;
        }
    }
}
