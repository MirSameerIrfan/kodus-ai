import { randomUUID } from 'node:crypto';

import type { ExecutionTraceEntry, GeneratedLesson } from './types.js';

export interface GeneratorOptions {
    domain: string;
    intent: string;
}

export class LessonGenerator {
    constructor(private readonly options: GeneratorOptions) {}

    generate(trace: ExecutionTraceEntry[]): GeneratedLesson[] {
        return trace.map((entry) => {
            const id = `lesson-${entry.id}-${randomUUID().slice(0, 8)}`;
            const base = entry.outcome === 'success' ? '[SUCESSO]' : '[FALHA]';
            const content =
                entry.outcome === 'success'
                    ? `Ao atender ${this.options.intent}, repetir estratégia: ${entry.description}`
                    : `Evitar falha no contexto ${this.options.intent}: ${entry.description}`;

            return {
                id,
                content: `${base} ${content}`,
                rationale: entry.metadata?.rationale as string | undefined,
                source: 'execution',
                relatedTraceIds: [entry.id],
            };
        });
    }
}
