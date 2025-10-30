import { randomUUID } from 'node:crypto';

import type { KnowledgeStore, KnowledgeRecord } from '../store/index.js';
import type { ReflectedLesson, CuratedBullet } from './types.js';

export interface CuratorOptions {
    domain: string;
    intent: string;
    author?: string;
}

const BULLET_TAG = 'ace-bullet';

function normalize(content: string): string {
    return content.replace(/\s+/g, ' ').trim().toLowerCase();
}

export class LessonCurator {
    constructor(
        private readonly store: KnowledgeStore,
        private readonly options: CuratorOptions,
    ) {}

    async curate(lessons: ReflectedLesson[]): Promise<CuratedBullet[]> {
        const existing = await this.store.query({
            domain: this.options.domain,
            tags: [BULLET_TAG],
        });

        const normalizedIndex = new Map<string, KnowledgeRecord>();
        for (const record of existing) {
            normalizedIndex.set(normalize(record.payload.text ?? ''), record);
        }

        const curated: CuratedBullet[] = [];

        for (const lesson of lessons) {
            if (lesson.verdict === 'drop') {
                continue;
            }

            const normalized = normalize(lesson.content);
            const match = normalizedIndex.get(normalized);

            if (match) {
                curated.push({
                    record: match,
                    deltaType: 'unchanged',
                });

                if (lesson.verdict === 'revise') {
                    match.metadata.lineage.push({
                        timestamp: Date.now(),
                        actor: 'human',
                        action: 'updated',
                        notes: lesson.notes,
                    });
                    match.metadata.updatedAt = Date.now();
                    await this.store.upsert(match);
                    curated[curated.length - 1].deltaType = 'updated';
                }

                continue;
            }

            const record: KnowledgeRecord = {
                id: `bullet-${randomUUID()}`,
                domain: this.options.domain,
                source: {
                    type: 'ace',
                    location: `intent://${this.options.intent}/${lesson.id}`,
                },
                payload: {
                    text: lesson.content,
                },
                metadata: {
                    version: '1.0.0',
                    title: `ACE • ${this.options.intent}`,
                    tags: [BULLET_TAG, this.options.intent],
                    confidentiality: 'internal',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    lineage: [
                        {
                            timestamp: Date.now(),
                            actor: 'automation',
                            action: 'created',
                            notes: lesson.rationale ?? lesson.notes,
                        },
                    ],
                    ownerId: this.options.author ?? 'ace-pipeline',
                },
                feedback: {
                    helpful: 0,
                    harmful: 0,
                },
            };

            await this.store.upsert(record);
            normalizedIndex.set(normalized, record);

            curated.push({
                record,
                deltaType: 'new',
            });
        }

        return curated;
    }
}
