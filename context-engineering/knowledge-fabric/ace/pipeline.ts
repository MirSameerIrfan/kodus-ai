import { LessonGenerator, type GeneratorOptions } from './generator.js';
import { LessonReflector, type ReflectorOptions } from './reflector.js';
import { LessonCurator, type CuratorOptions } from './curator.js';
import type { KnowledgeStore } from '../store/index.js';
import type {
    CuratedBullet,
    ExecutionTraceEntry,
    GeneratedLesson,
    ReflectedLesson,
} from './types.js';

export interface ACEPipelineOptions {
    generator: GeneratorOptions;
    reflector?: ReflectorOptions;
    curator: CuratorOptions;
    maxBullets?: number;
}

export class ACEPipeline {
    private readonly generator: LessonGenerator;
    private readonly reflector: LessonReflector;
    private readonly curator: LessonCurator;
    private readonly curatorDomainValue: string;
    private readonly maxBullets: number;

    constructor(private readonly store: KnowledgeStore, options: ACEPipelineOptions) {
        this.generator = new LessonGenerator(options.generator);
        this.reflector = new LessonReflector(options.reflector);
        this.curator = new LessonCurator(store, options.curator);
        this.maxBullets = options.maxBullets ?? 100;
        this.curatorDomainValue = options.curator.domain;
    }

    async run(trace: ExecutionTraceEntry[]): Promise<CuratedBullet[]> {
        const lessons = this.generator.generate(trace);
        const reflected = this.reflector.reflect(lessons);
        const curated = await this.curator.curate(reflected);

        await this.enforceBudget();

        return curated;
    }

    private async enforceBudget(): Promise<void> {
        const bullets = await this.store.query({
            domain: this.curatorDomain(),
            tags: ['ace-bullet'],
        });

        if (bullets.length <= this.maxBullets) {
            return;
        }

        const ordered = bullets.sort((a, b) => {
            const aScore = a.feedback?.helpful ?? 0 - (a.feedback?.harmful ?? 0);
            const bScore = b.feedback?.helpful ?? 0 - (b.feedback?.harmful ?? 0);
            if (aScore === bScore) {
                return (a.metadata.updatedAt ?? 0) - (b.metadata.updatedAt ?? 0);
            }
            return aScore - bScore;
        });

        // Trim os que têm menor score, mantendo os mais úteis.
        const toRemove = ordered.slice(0, ordered.length - this.maxBullets);
        for (const record of toRemove) {
            await this.store.appendLineage(record.id, {
                timestamp: Date.now(),
                actor: 'automation',
                action: 'compacted',
                notes: 'Removido por budget ACE.',
            });
        }
    }

    private curatorDomain(): string {
        return this.curatorDomainValue;
    }

    // Expostos para testes/manual
    generate(trace: ExecutionTraceEntry[]): GeneratedLesson[] {
        return this.generator.generate(trace);
    }

    reflect(lessons: GeneratedLesson[]): ReflectedLesson[] {
        return this.reflector.reflect(lessons);
    }
}
