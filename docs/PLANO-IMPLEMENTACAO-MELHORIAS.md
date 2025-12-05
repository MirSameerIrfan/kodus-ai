# Plano de Implementação: Melhorias de Qualidade

**Data**: 2025-01-27  
**Status**: 🚀 **PRONTO PARA IMPLEMENTAR**

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Fase 1: Retry Policy Avançada](#fase-1-retry-policy-avançada)
3. [Fase 2: Distributed Lock](#fase-2-distributed-lock)
4. [Fase 3: Cache de Configurações](#fase-3-cache-de-configurações)
5. [Fase 4: Otimização de Serialização](#fase-4-otimização-de-serialização)
6. [Fase 5: Observability Consistente](#fase-5-observability-consistente)

---

## 🎯 Visão Geral

### Objetivo

Melhorar qualidade da implementação atual focando em:
- ✅ Resiliência (retry policy avançada)
- ✅ Idempotência (distributed lock)
- ✅ Performance (cache de configurações, otimização de serialização)
- ✅ Observabilidade (uso consistente)

### Escopo

**Implementar AGORA**:
- ✅ Retry Policy Avançada
- ✅ Distributed Lock
- ✅ Cache de Configurações
- ✅ Otimização de Serialização
- ✅ Observability Consistente

**Deixar para DEPOIS**:
- ⏸️ Métricas (Prometheus/StatsD)

---

## 🔄 Fase 1: Retry Policy Avançada

### Objetivo

Criar wrapper de retry usando `exponential-backoff.ts` existente.

### Arquivos a Criar

**1. `src/core/infrastructure/adapters/services/workflowQueue/retry-policy.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { createLogger } from '@kodus/flow';
import {
    calculateBackoffInterval,
    BackoffOptions,
    BackoffPresets,
} from '@/shared/utils/polling/exponential-backoff';

export interface RetryPolicy {
    maxAttempts: number;
    backoff: BackoffOptions;
    retryableErrors?: (error: Error) => boolean;
    onRetry?: (attempt: number, error: Error, delay: number) => void;
}

@Injectable()
export class RetryPolicyService {
    private readonly logger = createLogger(RetryPolicyService.name);

    /**
     * Execute function with retry policy
     */
    async executeWithRetry<T>(
        fn: () => Promise<T>,
        policy: RetryPolicy,
    ): Promise<T> {
        let attempt = 0;
        let lastError: Error | undefined;

        while (attempt < policy.maxAttempts) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                attempt++;

                // Check if error is retryable
                if (
                    policy.retryableErrors &&
                    !policy.retryableErrors(lastError)
                ) {
                    throw lastError; // Don't retry non-retryable errors
                }

                // Check if max attempts reached
                if (attempt >= policy.maxAttempts) {
                    this.logger.error({
                        message: `Max retry attempts (${policy.maxAttempts}) reached`,
                        context: RetryPolicyService.name,
                        error: lastError,
                        metadata: { attempt, maxAttempts: policy.maxAttempts },
                    });
                    throw lastError;
                }

                // Calculate backoff delay
                const delay = calculateBackoffInterval(attempt - 1, policy.backoff);

                // Callback before retry
                if (policy.onRetry) {
                    policy.onRetry(attempt, lastError, delay);
                }

                this.logger.warn({
                    message: `Retrying operation (attempt ${attempt}/${policy.maxAttempts})`,
                    context: RetryPolicyService.name,
                    error: lastError,
                    metadata: {
                        attempt,
                        maxAttempts: policy.maxAttempts,
                        delayMs: delay,
                    },
                });

                // Wait before retry
                await this.sleep(delay);
            }
        }

        // Should never reach here, but TypeScript needs it
        throw lastError || new Error('Retry failed');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
```

**2. Configuração padrão**

```typescript
// src/core/infrastructure/adapters/services/workflowQueue/retry-policy.config.ts
import { BackoffPresets } from '@/shared/utils/polling/exponential-backoff';
import { RetryPolicy } from './retry-policy.service';

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
    maxAttempts: 3,
    backoff: BackoffPresets.STANDARD, // 1s, 2s, 4s, 8s, 16s, 30s (cap)
    retryableErrors: (error: Error) => {
        // Retry apenas em erros temporários
        const retryableErrorNames = [
            'NetworkError',
            'TimeoutError',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
        ];
        return retryableErrorNames.some((name) => error.name.includes(name));
    },
};
```

### Arquivos a Modificar

**1. `src/modules/workflowQueue.module.ts`**

```typescript
// Adicionar RetryPolicyService aos providers
import { RetryPolicyService } from '@/core/infrastructure/adapters/services/workflowQueue/retry-policy.service';

@Module({
    providers: [
        // ... existentes
        RetryPolicyService,
    ],
    exports: [
        // ... existentes
        RetryPolicyService,
    ],
})
```

**2. `src/core/infrastructure/adapters/services/workflowQueue/code-review-job-processor.service.ts`**

```typescript
// Adicionar RetryPolicyService
constructor(
    // ... existentes
    private readonly retryPolicyService: RetryPolicyService,
) {}

// Usar em operações que podem falhar
async process(jobId: string): Promise<void> {
    // ... código existente
    
    // Envolver operações críticas com retry
    await this.retryPolicyService.executeWithRetry(
        () => this.executePipeline(job),
        DEFAULT_RETRY_POLICY,
    );
}
```

### Testes

```typescript
// Criar: src/core/infrastructure/adapters/services/workflowQueue/__tests__/retry-policy.service.spec.ts
describe('RetryPolicyService', () => {
    it('should retry on failure', async () => {
        // Test implementation
    });
    
    it('should respect max attempts', async () => {
        // Test implementation
    });
    
    it('should not retry non-retryable errors', async () => {
        // Test implementation
    });
});
```

### Estimativa

- **Tempo**: 2-3 horas
- **Complexidade**: Baixa (reusar código existente)

---

## 🔒 Fase 2: Distributed Lock

### Objetivo

Implementar lock distribuído usando PostgreSQL Advisory Lock.

### Arquivos a Criar

**1. `src/core/infrastructure/adapters/services/workflowQueue/distributed-lock.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createLogger } from '@kodus/flow';

export interface DistributedLockOptions {
    ttl?: number; // Time to live em ms (opcional, para auto-release)
}

export class DistributedLock {
    constructor(
        private readonly dataSource: DataSource,
        private readonly lockId: number,
        private readonly ttl?: number,
        private readonly logger = createLogger(DistributedLock.name),
    ) {
        if (ttl) {
            // Auto-release após TTL
            setTimeout(() => {
                this.release().catch((error) => {
                    this.logger.error({
                        message: 'Error auto-releasing lock',
                        context: DistributedLock.name,
                        error,
                        metadata: { lockId },
                    });
                });
            }, ttl);
        }
    }

    async release(): Promise<void> {
        try {
            await this.dataSource.query(
                `SELECT pg_advisory_unlock($1)`,
                [this.lockId],
            );
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
                    message: 'Could not acquire distributed lock (already in use)',
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
            hash = ((hash << 5) + hash) + key.charCodeAt(i);
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
                await this.dataSource.query(
                    `SELECT pg_advisory_unlock($1)`,
                    [lockId],
                );
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
```

### Arquivos a Modificar

**1. `src/modules/workflowQueue.module.ts`**

```typescript
import { DistributedLockService } from '@/core/infrastructure/adapters/services/workflowQueue/distributed-lock.service';

@Module({
    providers: [
        // ... existentes
        DistributedLockService,
    ],
    exports: [
        // ... existentes
        DistributedLockService,
    ],
})
```

**2. `src/core/infrastructure/adapters/services/workflowQueue/code-review-job-processor.service.ts`**

```typescript
constructor(
    // ... existentes
    private readonly distributedLockService: DistributedLockService,
) {}

async process(jobId: string): Promise<void> {
    // ✅ Adquirir lock distribuído
    const lock = await this.distributedLockService.acquire(`job:${jobId}`, {
        ttl: 300000, // 5 minutos (auto-release se worker crashar)
    });

    if (!lock) {
        // Job já está sendo processado por outro worker
        this.logger.warn({
            message: `Job ${jobId} already being processed by another worker`,
            context: CodeReviewJobProcessorService.name,
            metadata: { jobId },
        });
        return;
    }

    try {
        // Verificar se já foi processado
        const job = await this.jobRepository.findOne(jobId);
        if (job.status === JobStatus.COMPLETED) {
            return; // Já processado
        }

        await this.executePipeline(job);
    } finally {
        await lock.release();
    }
}
```

### Testes

```typescript
// Criar: src/core/infrastructure/adapters/services/workflowQueue/__tests__/distributed-lock.service.spec.ts
describe('DistributedLockService', () => {
    it('should acquire lock successfully', async () => {
        // Test implementation
    });
    
    it('should return null if lock already acquired', async () => {
        // Test implementation
    });
    
    it('should release lock', async () => {
        // Test implementation
    });
    
    it('should auto-release after TTL', async () => {
        // Test implementation
    });
});
```

### Estimativa

- **Tempo**: 3-4 horas
- **Complexidade**: Média (nova funcionalidade)

---

## 🗄️ Fase 3: Cache de Configurações

### Objetivo

Criar wrapper para cachear configurações usando `CacheService` existente.

### Arquivos a Criar

**1. `src/core/infrastructure/adapters/services/codeBase/code-base-config-cache.service.ts`**

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { createLogger } from '@kodus/flow';
import { CacheService } from '@/shared/utils/cache/cache.service';
import {
    CODE_BASE_CONFIG_SERVICE_TOKEN,
    ICodeBaseConfigService,
} from '@/core/domain/codeBase/contracts/CodeBaseConfigService.contract';
import {
    CodeReviewConfig,
    FileChange,
    Repository,
} from '@/config/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import { createHash } from 'crypto';

@Injectable()
export class CodeBaseConfigCacheService {
    private readonly logger = createLogger(CodeBaseConfigCacheService.name);
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    constructor(
        @Inject(CODE_BASE_CONFIG_SERVICE_TOKEN)
        private readonly codeBaseConfigService: ICodeBaseConfigService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Busca configuração com cache
     */
    async getConfig(
        organizationAndTeamData: OrganizationAndTeamData,
        repository: Repository,
        files: FileChange[],
    ): Promise<CodeReviewConfig> {
        const cacheKey = this.getCacheKey(
            organizationAndTeamData,
            repository,
            files,
        );

        // Tentar buscar do cache
        const cached = await this.cacheService.getFromCache<CodeReviewConfig>(
            cacheKey,
        );
        if (cached) {
            this.logger.debug({
                message: 'Config retrieved from cache',
                context: CodeBaseConfigCacheService.name,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    repositoryId: repository.id,
                    cacheKey,
                },
            });
            return cached;
        }

        // Buscar do serviço
        const config = await this.codeBaseConfigService.getConfig(
            organizationAndTeamData,
            repository,
            files,
        );

        // Salvar no cache
        await this.cacheService.addToCache(cacheKey, config, this.CACHE_TTL);

        this.logger.debug({
            message: 'Config cached',
            context: CodeBaseConfigCacheService.name,
            metadata: {
                organizationId: organizationAndTeamData.organizationId,
                repositoryId: repository.id,
                cacheKey,
                ttl: this.CACHE_TTL,
            },
        });

        return config;
    }

    /**
     * Invalidar cache quando configuração muda
     */
    async invalidateCache(
        organizationId: string,
        repositoryId?: string,
    ): Promise<void> {
        // Por enquanto, limpar todo cache (pode ser otimizado depois)
        // TODO: Implementar invalidação seletiva por chave pattern
        await this.cacheService.clearCache();

        this.logger.log({
            message: 'Config cache invalidated',
            context: CodeBaseConfigCacheService.name,
            metadata: { organizationId, repositoryId },
        });
    }

    /**
     * Criar chave de cache única
     */
    private getCacheKey(
        organizationAndTeamData: OrganizationAndTeamData,
        repository: Repository,
        files: FileChange[],
    ): string {
        // Criar hash dos arquivos (ou apenas contagem se hash for muito caro)
        const filesHash = this.hashFiles(files);
        return `config:${organizationAndTeamData.organizationId}:${repository.id}:${filesHash}`;
    }

    /**
     * Hash dos arquivos para cache key
     * Usa hash simples baseado em nomes e tamanhos dos arquivos
     */
    private hashFiles(files: FileChange[]): string {
        // Criar string representando os arquivos
        const filesStr = files
            .map((f) => `${f.filename}:${f.additions || 0}:${f.deletions || 0}`)
            .sort()
            .join('|');

        // Hash MD5 (rápido e suficiente para cache key)
        return createHash('md5').update(filesStr).digest('hex').substring(0, 16);
    }
}
```

### Arquivos a Modificar

**1. `src/modules/codeReviewPipeline.module.ts`**

```typescript
import { CodeBaseConfigCacheService } from '@/core/infrastructure/adapters/services/codeBase/code-base-config-cache.service';

@Module({
    providers: [
        // ... existentes
        CodeBaseConfigCacheService,
    ],
    exports: [
        // ... existentes
        CodeBaseConfigCacheService,
    ],
})
```

**2. `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/stages/resolve-config.stage.ts`**

```typescript
constructor(
    // ... existentes
    @Inject(CODE_BASE_CONFIG_CACHE_SERVICE_TOKEN)
    private readonly configCacheService: CodeBaseConfigCacheService,
) {}

async execute(context: CodeReviewPipelineContext): Promise<CodeReviewPipelineContext> {
    // ANTES:
    // const config = await this.codeBaseConfigService.getConfig(...);
    
    // DEPOIS:
    const config = await this.configCacheService.getConfig(
        context.organizationAndTeamData,
        context.repository,
        preliminaryFiles,
    );
    
    // ... resto do código
}
```

**3. Criar token de injeção**

```typescript
// src/core/domain/codeBase/contracts/CodeBaseConfigService.contract.ts
export const CODE_BASE_CONFIG_CACHE_SERVICE_TOKEN = 'CODE_BASE_CONFIG_CACHE_SERVICE';
```

### Testes

```typescript
// Criar: src/core/infrastructure/adapters/services/codeBase/__tests__/code-base-config-cache.service.spec.ts
describe('CodeBaseConfigCacheService', () => {
    it('should cache config', async () => {
        // Test implementation
    });
    
    it('should return cached config on second call', async () => {
        // Test implementation
    });
    
    it('should invalidate cache', async () => {
        // Test implementation
    });
});
```

### Estimativa

- **Tempo**: 2-3 horas
- **Complexidade**: Baixa (wrapper sobre código existente)

---

## 💾 Fase 4: Otimização de Serialização

### Objetivo

Otimizar serialização de estado (delta, compressão, ou mínimo).

### Opções de Implementação

**Opção A: Serialização Incremental (Delta)** ⭐ Recomendado

**Opção B: Compressão**

**Opção C: Estado Mínimo**

### Arquivos a Criar

**1. `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/pipeline/state-serializer.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { createLogger } from '@kodus/flow';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { CodeReviewPipelineContext } from '../../context/code-review-pipeline.context';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface SerializationOptions {
    strategy: 'full' | 'delta' | 'minimal' | 'compressed';
    previousState?: CodeReviewPipelineContext;
}

@Injectable()
export class StateSerializerService {
    private readonly logger = createLogger(StateSerializerService.name);

    /**
     * Serializa estado com estratégia configurável
     */
    async serialize(
        context: CodeReviewPipelineContext,
        options: SerializationOptions = { strategy: 'full' },
    ): Promise<Record<string, unknown>> {
        switch (options.strategy) {
            case 'delta':
                return this.serializeDelta(context, options.previousState);
            case 'minimal':
                return this.serializeMinimal(context);
            case 'compressed':
                return await this.serializeCompressed(context);
            case 'full':
            default:
                return this.serializeFull(context);
        }
    }

    /**
     * Serialização completa (atual)
     */
    private serializeFull(
        context: CodeReviewPipelineContext,
    ): Record<string, unknown> {
        return JSON.parse(JSON.stringify(context));
    }

    /**
     * Serialização incremental (apenas mudanças)
     */
    private serializeDelta(
        currentState: CodeReviewPipelineContext,
        previousState?: CodeReviewPipelineContext,
    ): Record<string, unknown> {
        if (!previousState) {
            // Primeiro checkpoint - salvar tudo
            return this.serializeFull(currentState);
        }

        const delta: Record<string, unknown> = {
            currentStage: currentState.currentStage,
            updatedAt: Date.now(),
        };

        // Comparar e adicionar apenas mudanças significativas
        if (
            JSON.stringify(currentState.validSuggestions) !==
            JSON.stringify(previousState.validSuggestions)
        ) {
            delta.validSuggestions = currentState.validSuggestions;
        }

        if (
            JSON.stringify(currentState.fileMetadata) !==
            JSON.stringify(previousState.fileMetadata)
        ) {
            delta.fileMetadata = currentState.fileMetadata;
        }

        // ... outras comparações

        return delta;
    }

    /**
     * Serialização mínima (apenas IDs e referências)
     */
    private serializeMinimal(
        context: CodeReviewPipelineContext,
    ): Record<string, unknown> {
        return {
            workflowJobId: context.workflowJobId,
            currentStage: context.currentStage,
            correlationId: context.correlationId,
            automationExecutionId: context.automationExecutionId,

            // Apenas IDs, não objetos completos
            organizationId: context.organizationAndTeamData?.organizationId,
            teamId: context.organizationAndTeamData?.teamId,
            repositoryId: context.repository?.id,
            pullRequestNumber: context.pullRequest?.number,

            // Metadados mínimos
            validSuggestionsCount: context.validSuggestions?.length || 0,
            changedFilesCount: context.changedFiles?.length || 0,
        };
    }

    /**
     * Serialização comprimida
     */
    private async serializeCompressed(
        context: CodeReviewPipelineContext,
    ): Promise<Record<string, unknown>> {
        const serialized = JSON.stringify(context);
        const compressed = await gzip(Buffer.from(serialized));
        return {
            compressed: true,
            data: compressed.toString('base64'),
        };
    }

    /**
     * Deserializa estado comprimido
     */
    async deserializeCompressed(
        data: Record<string, unknown>,
    ): Promise<CodeReviewPipelineContext> {
        if (!data.compressed || typeof data.data !== 'string') {
            throw new Error('Invalid compressed state format');
        }

        const decompressed = await gunzip(Buffer.from(data.data, 'base64'));
        return JSON.parse(decompressed.toString());
    }
}
```

### Arquivos a Modificar

**1. `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/pipeline/pipeline-state-manager.service.ts`**

```typescript
constructor(
    private readonly jobRepository: WorkflowJobRepository,
    private readonly stateSerializer: StateSerializerService, // Novo
) {}

async saveState(
    workflowJobId: string,
    context: CodeReviewPipelineContext,
    previousState?: CodeReviewPipelineContext, // Novo parâmetro opcional
): Promise<void> {
    // Usar serialização otimizada
    const stateObject = await this.stateSerializer.serialize(context, {
        strategy: 'delta', // ou 'compressed' ou 'minimal'
        previousState,
    });

    await this.jobRepository.updatePipelineState(workflowJobId, stateObject);
}
```

### Estimativa

- **Tempo**: 4-5 horas
- **Complexidade**: Média-Alta (requer testes cuidadosos)

---

## 📊 Fase 5: Observability Consistente

### Objetivo

Garantir uso consistente de observability em todos os componentes.

### Arquivos a Modificar

**1. `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/pipeline/pipeline-executor.service.ts`**

```typescript
// Adicionar spans em pontos críticos
async execute(...): Promise<CodeReviewPipelineContext> {
    return await this.observability.runInSpan(
        'pipeline.executor.execute',
        async (span) => {
            span.setAttributes({
                'pipeline.name': pipelineName,
                'pipeline.stages.count': stages.length,
                'workflow.job.id': workflowJobId,
            });

            // ... código existente

            // Adicionar span por stage
            for (const stageName of executionOrder) {
                await this.observability.runInSpan(
                    `pipeline.stage.${stageName}`,
                    async (stageSpan) => {
                        stageSpan.setAttributes({
                            'stage.name': stageName,
                            'stage.type': stage.isLight() ? 'light' : 'heavy',
                        });
                        // ... executar stage
                    },
                );
            }
        },
    );
}
```

**2. `src/core/infrastructure/adapters/services/codeBase/codeReviewPipeline/handlers/heavy-stage-event.handler.ts`**

```typescript
// Já tem observability, mas pode melhorar
@RabbitSubscribe({...})
async onStageCompleted(event: StageCompletedEvent, amqpMsg: any): Promise<void> {
    return await this.observability.runInSpan(
        'workflow.event.heavy_stage_completed',
        async (span) => {
            // ... código existente já tem spans
        },
    );
}
```

### Estimativa

- **Tempo**: 2-3 horas
- **Complexidade**: Baixa (adicionar spans em pontos críticos)

---

## 📋 Resumo de Implementação

### Ordem de Implementação Recomendada

1. **Fase 1: Retry Policy** (2-3h) - Base para resiliência
2. **Fase 2: Distributed Lock** (3-4h) - Crítico para idempotência
3. **Fase 3: Config Cache** (2-3h) - Melhoria rápida de performance
4. **Fase 5: Observability** (2-3h) - Melhoria de visibilidade
5. **Fase 4: Serialization** (4-5h) - Otimização mais complexa

### Tempo Total Estimado

- **Total**: 13-18 horas (~2-3 dias de desenvolvimento)

### Dependências

- **Fase 1**: Nenhuma
- **Fase 2**: Nenhuma
- **Fase 3**: Nenhuma
- **Fase 4**: Pode usar cache (Fase 3)
- **Fase 5**: Nenhuma

---

## ✅ Checklist de Implementação

### Fase 1: Retry Policy
- [ ] Criar `RetryPolicyService`
- [ ] Criar configuração padrão
- [ ] Integrar no `WorkflowQueueModule`
- [ ] Usar no `CodeReviewJobProcessor`
- [ ] Testes unitários

### Fase 2: Distributed Lock
- [ ] Criar `DistributedLockService`
- [ ] Criar classe `DistributedLock`
- [ ] Integrar no `WorkflowQueueModule`
- [ ] Usar no `CodeReviewJobProcessor`
- [ ] Testes unitários

### Fase 3: Config Cache
- [ ] Criar `CodeBaseConfigCacheService`
- [ ] Criar token de injeção
- [ ] Integrar no `CodeReviewPipelineModule`
- [ ] Usar no `ResolveConfigStage`
- [ ] Testes unitários

### Fase 4: Serialization
- [ ] Criar `StateSerializerService`
- [ ] Implementar estratégias (delta/compressed/minimal)
- [ ] Integrar no `PipelineStateManager`
- [ ] Testes unitários
- [ ] Benchmark antes/depois

### Fase 5: Observability
- [ ] Adicionar spans no `PipelineExecutor`
- [ ] Adicionar spans nos stages críticos
- [ ] Verificar spans em event handlers
- [ ] Testes de integração

---

**Última Atualização**: 2025-01-27  
**Status**: 🚀 Pronto para implementar

