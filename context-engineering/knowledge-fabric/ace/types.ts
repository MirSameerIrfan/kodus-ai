import type { KnowledgeRecord } from '../store/index.js';

export type LessonSource = 'execution' | 'manual' | 'reflector';

export interface ExecutionTraceEntry {
    id: string;
    description: string;
    outcome: 'success' | 'failure';
    metadata?: Record<string, unknown>;
}

export interface GeneratedLesson {
    id: string;
    content: string;
    rationale?: string;
    source: LessonSource;
    relatedTraceIds: string[];
}

export interface ReflectedLesson extends GeneratedLesson {
    verdict: 'keep' | 'drop' | 'revise';
    notes?: string;
}

export interface CuratedBullet {
    record: KnowledgeRecord;
    deltaType: 'new' | 'updated' | 'unchanged';
}
