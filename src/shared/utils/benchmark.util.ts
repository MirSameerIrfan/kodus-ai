import { SimpleLogger } from '@kodus/flow/dist/observability/logger';

export async function benchmark<T>(
    payload: { label: string; metadata?: any },
    logger: SimpleLogger,
    fn: () => Promise<T>,
): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = (performance.now() - start).toFixed(2);

    logger.log({
        message: `⏱️ ${payload?.label} - ${duration}ms`,
        context: 'Benchmark',
        metadata: { ...payload?.metadata },
    });

    return result;
}
