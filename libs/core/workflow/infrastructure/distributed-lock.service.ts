import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface DistributedLockOptions {
    ttl?: number; // Time to live in ms (optional, for auto-release)
}

export class DistributedLock {
    private released = false;

    constructor(
        private readonly dataSource: DataSource,
        private readonly lockId: number,
        private readonly ttl?: number,
        private readonly logger = createLogger(DistributedLock.name),
    ) {
        if (ttl) {
            // Auto-release after TTL
            setTimeout(() => {
                if (!this.released) {
                    this.release().catch((error) => {
                        this.logger.error({
                            message: 'Error auto-releasing lock',
                            context: DistributedLock.name,
                            error,
                            metadata: { lockId },
                        });
                    });
                }
            }, ttl);
        }
    }

    async release(): Promise<void> {
        if (this.released) {
            return; // Already released
        }

        try {
            await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [
                this.lockId,
            ]);
            this.released = true;
            this.logger.debug({
                message: 'Distributed lock released',
                context: DistributedLock.name,
                metadata: { lockId: this.lockId },
            });
        } catch (error) {
            this.logger.error({
                message: 'Error releasing distributed lock',
                context: DistributedLock.name,
                error: error instanceof Error ? error : undefined,
                metadata: { lockId: this.lockId },
            });
            throw error;
        }
    }

    isReleased(): boolean {
        return this.released;
    }
}

@Injectable()
export class DistributedLockService {
    private readonly logger = createLogger(DistributedLockService.name);

    constructor(private readonly dataSource: DataSource) {}

    /**
     * Acquire distributed lock using PostgreSQL Advisory Lock
     * @param key - Unique lock key (e.g. `job:${jobId}`)
     * @param options - Lock options (TTL for auto-release)
     * @returns Lock object or null if could not acquire
     */
    async acquire(
        key: string,
        options: DistributedLockOptions = {},
    ): Promise<DistributedLock | null> {
        const lockId = this.hashKey(key);

        try {
            const result = await this.dataSource.query(
                `SELECT pg_try_advisory_lock($1) as acquired`,
                [lockId],
            );

            if (!result[0]?.acquired) {
                this.logger.debug({
                    message:
                        'Could not acquire distributed lock (already in use)',
                    context: DistributedLockService.name,
                    metadata: { key, lockId },
                });
                return null; // Lock is already in use
            }

            this.logger.debug({
                message: 'Distributed lock acquired',
                context: DistributedLockService.name,
                metadata: { key, lockId, ttl: options.ttl },
            });

            return new DistributedLock(
                this.dataSource,
                lockId,
                options.ttl,
                this.logger,
            );
        } catch (error) {
            this.logger.error({
                message: 'Error acquiring distributed lock',
                context: DistributedLockService.name,
                error: error instanceof Error ? error : undefined,
                metadata: { key, lockId },
            });
            throw error;
        }
    }

    /**
     * Hash string key to bigint for PostgreSQL advisory lock
     * PostgreSQL advisory locks use bigint (64-bit integer)
     */
    private hashKey(key: string): number {
        // Use simple hash (djb2 algorithm)
        let hash = 5381;
        for (let i = 0; i < key.length; i++) {
            hash = (hash << 5) + hash + key.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        // PostgreSQL needs a positive number
        return Math.abs(hash);
    }

    /**
     * Verify if lock is in use (without acquiring)
     */
    async isLocked(key: string): Promise<boolean> {
        const lockId = this.hashKey(key);
        try {
            const result = await this.dataSource.query(
                `SELECT pg_try_advisory_lock($1) as acquired`,
                [lockId],
            );

            if (result[0]?.acquired) {
                // Release immediately (was just checking)
                await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [
                    lockId,
                ]);
                return false; // Was not in use
            }

            return true; // Is in use
        } catch (error) {
            this.logger.error({
                message: 'Error checking lock status',
                context: DistributedLockService.name,
                error: error instanceof Error ? error : undefined,
                metadata: { key, lockId },
            });
            // On error, assume it is locked (fail-safe)
            return true;
        }
    }
}
