import { createLogger } from '@kodus/flow';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface DistributedLockOptions {
    ttl?: number; // Time to live em ms (opcional, para auto-release)
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
            // Auto-release após TTL
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
     * Adquirir lock distribuído usando PostgreSQL Advisory Lock
     * @param key - Chave única do lock (ex: `job:${jobId}`)
     * @param options - Opções do lock (TTL para auto-release)
     * @returns Lock object ou null se não conseguir adquirir
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
                return null; // Lock já está em uso
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
     * PostgreSQL advisory locks usam bigint (64-bit integer)
     */
    private hashKey(key: string): number {
        // Usar hash simples (djb2 algorithm)
        let hash = 5381;
        for (let i = 0; i < key.length; i++) {
            hash = (hash << 5) + hash + key.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        // PostgreSQL precisa de número positivo
        return Math.abs(hash);
    }

    /**
     * Verificar se lock está em uso (sem adquirir)
     */
    async isLocked(key: string): Promise<boolean> {
        const lockId = this.hashKey(key);
        try {
            const result = await this.dataSource.query(
                `SELECT pg_try_advisory_lock($1) as acquired`,
                [lockId],
            );

            if (result[0]?.acquired) {
                // Liberar imediatamente (só estava verificando)
                await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [
                    lockId,
                ]);
                return false; // Não estava em uso
            }

            return true; // Está em uso
        } catch (error) {
            this.logger.error({
                message: 'Error checking lock status',
                context: DistributedLockService.name,
                error: error instanceof Error ? error : undefined,
                metadata: { key, lockId },
            });
            // Em caso de erro, assumir que está locked (fail-safe)
            return true;
        }
    }
}
