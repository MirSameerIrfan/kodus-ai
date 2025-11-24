import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorResult, MemoryHealthIndicator } from '@nestjs/terminus';

@Injectable()
export class ApplicationHealthIndicator {
    constructor(
        private readonly configService: ConfigService,
        private readonly memoryHealthIndicator: MemoryHealthIndicator,
    ) {}

    async isApplicationHealthy(): Promise<HealthIndicatorResult> {
        const env = process.env.API_NODE_ENV;
        const uptime = Math.floor(process.uptime());

        // Verifica se o Heap de memória não ultrapassou 6GB (ajuste para container com limite de 8GB)
        // Deixa 2GB de margem de segurança antes do limite teórico
        const memoryCheck = await this.memoryHealthIndicator.checkHeap(
            'memory_heap',
            6 * 1024 * 1024 * 1024,
        );

        const isMemoryHealthy = memoryCheck.memory_heap.status === 'up';
        const hasValidEnv = !!env;

        // Removemos a checagem arbitrária de uptime > 5s que causava falso down no boot
        const allChecksPass = hasValidEnv && isMemoryHealthy;
        const uptimeFormatted = this.formatUptime(uptime);

        return {
            application: {
                status: allChecksPass ? 'up' : 'down',
                uptime: uptimeFormatted,
                timestamp: new Date().toISOString(),
                environment: env,
                memory: memoryCheck.memory_heap,
            },
        };
    }

    private formatUptime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}
