import type { GeneratedLesson, ReflectedLesson } from './types.js';

export interface ReflectorOptions {
    dropIfDuplicate?: (lesson: GeneratedLesson) => boolean;
}

export class LessonReflector {
    constructor(private readonly options: ReflectorOptions = {}) {}

    reflect(lessons: GeneratedLesson[]): ReflectedLesson[] {
        return lessons.map((lesson) => {
            if (this.options.dropIfDuplicate?.(lesson)) {
                return {
                    ...lesson,
                    verdict: 'drop',
                    notes: 'Marcado como duplicado pelo refletor.',
                };
            }

            // Placeholder de heurística: se o lesson mencionar "failsafe" pedimos revisão.
            if (lesson.content.toLowerCase().includes('failsafe')) {
                return {
                    ...lesson,
                    verdict: 'revise',
                    notes: 'Revisar instrução para detalhar failsafe.',
                };
            }

            return {
                ...lesson,
                verdict: 'keep',
            };
        });
    }
}
