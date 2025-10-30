import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { ContextEvent } from '../../packages/context-os-core/src/interfaces.js';

interface TelemetrySnapshot {
    events: ContextEvent[];
}

const DEFAULT_SNAPSHOT: TelemetrySnapshot = {
    events: [],
};

export class ActionTelemetryRecorder {
    constructor(private readonly filePath = path.resolve(process.cwd(), 'context-engineering/telemetry/action-events.json')) {}

    async record(event: ContextEvent): Promise<void> {
        const snapshot = await this.readSnapshot();
        snapshot.events.push(event);
        await this.persist(snapshot);
    }

    async list(): Promise<ContextEvent[]> {
        const snapshot = await this.readSnapshot();
        return snapshot.events;
    }

    async clear(): Promise<void> {
        await this.persist(DEFAULT_SNAPSHOT);
    }

    private async readSnapshot(): Promise<TelemetrySnapshot> {
        try {
            const raw = await fs.readFile(this.filePath, 'utf-8');
            return JSON.parse(raw) as TelemetrySnapshot;
        } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
                return DEFAULT_SNAPSHOT;
            }
            throw error;
        }
    }

    private async persist(snapshot: TelemetrySnapshot): Promise<void> {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(this.filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    }
}

export interface ActionMetrics {
    success: number;
    failure: number;
    avgLatencyMs: number;
}

export function computeActionMetrics(events: ContextEvent[]): Record<string, ActionMetrics> {
    const metrics = new Map<string, { success: number; failure: number; latencyTotal: number; count: number }>();

    for (const event of events) {
        if (!event.type.startsWith('ACTION_') || !event.metadata?.actionId) {
            continue;
        }

        const key = String(event.metadata.actionId);
        const bucket = metrics.get(key) ?? { success: 0, failure: 0, latencyTotal: 0, count: 0 };

        if (event.type === 'ACTION_COMPLETED') {
            bucket.success += 1;
        }
        if (event.type === 'ACTION_FAILED') {
            bucket.failure += 1;
        }

        if (typeof event.latencyMs === 'number') {
            bucket.latencyTotal += event.latencyMs;
            bucket.count += 1;
        }

        metrics.set(key, bucket);
    }

    const result: Record<string, ActionMetrics> = {};
    for (const [actionId, bucket] of metrics.entries()) {
        result[actionId] = {
            success: bucket.success,
            failure: bucket.failure,
            avgLatencyMs: bucket.count ? bucket.latencyTotal / bucket.count : 0,
        };
    }

    return result;
}
