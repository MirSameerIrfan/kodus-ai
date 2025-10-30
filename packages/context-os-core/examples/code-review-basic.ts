import {
    CoreLayerBuilder,
    CatalogLayerBuilder,
    ActiveLayerBuilder,
    SequentialPackAssemblyPipeline,
} from '../src/index.js';
import type { ContextLayer, LayerBuildResult, LayerInputContext } from '../src/interfaces.js';
import type { CoreLayerMaterializer } from '../src/builders/core-layer-builder.js';
import type { CatalogLayerMaterializer } from '../src/builders/catalog-layer-builder.js';
import type { ActiveLayerSelector } from '../src/builders/active-layer-builder.js';

/**
 * Example materializer for the code review "core" layer.
 * Adds persona, instructions and basic constraints.
 */
class CodeReviewCoreMaterializer implements CoreLayerMaterializer {
    async materialize(input: LayerInputContext) {
        return {
            persona: {
                name: 'Kody Bug-Hunter',
                role: 'senior reviewer',
                description: 'Mentally executes code to detect production failures.',
            },
            instructions: [
                {
                    id: 'intent',
                    text: `Task intent: ${input.taskIntent}. Focus on functional regressions.`,
                    critical: true,
                },
                {
                    id: 'scope',
                    text: 'Only comment on lines that were added in this diff.',
                },
            ],
            constraints: [
                {
                    id: 'no-style',
                    text: 'Do not comment on style or formatting changes unless they introduce bugs.',
                },
            ],
            notes: ['Return JSON with validated line numbers.'],
        };
    }
}

/**
 * Catalog materializer summarises diff context.
 */
class CodeReviewCatalogMaterializer implements CatalogLayerMaterializer {
    async build(input: LayerInputContext) {
        const files = input.retrieval?.candidates?.map((c) => c.item.source.location) ?? [];
        return {
            entries: [
                {
                    id: 'summary',
                    title: 'Pull request summary',
                    summary: `Files touched: ${files.join(', ') || 'none'}.`,
                    importance: 'high',
                },
            ],
            insights: ['Check for missing validations and incorrect async flows.'],
        };
    }
}

/**
 * Active selector picks relevant snippets (toy example).
 */
class CodeReviewActiveSelector implements ActiveLayerSelector {
    async select(input: LayerInputContext) {
        const snippets = input.retrieval?.candidates?.slice(0, 3).map((candidate, index) => ({
            id: `${candidate.item.id}-snippet-${index}`,
            itemId: candidate.item.id,
            text: candidate.item.payload.text ?? 'No text provided',
            metadata: { source: candidate.item.source.location },
        })) ?? [];

        return {
            snippets,
            references: [],
            resources: [],
        };
    }
}

/**
 * Assemble the pack for a mock code review request.
 */
export async function runCodeReviewBasicExample(): Promise<ContextLayer[]> {
    const coreBuilder = new CoreLayerBuilder({
        materializer: new CodeReviewCoreMaterializer(),
    });
    const catalogBuilder = new CatalogLayerBuilder({
        materializer: new CodeReviewCatalogMaterializer(),
    });
    const activeBuilder = new ActiveLayerBuilder({
        selector: new CodeReviewActiveSelector(),
    });

    const pipeline = new SequentialPackAssemblyPipeline({
        steps: [
            { builder: coreBuilder, description: 'Core instructions' },
            { builder: catalogBuilder, description: 'Catalog summary' },
            { builder: activeBuilder, description: 'Active snippets' },
        ],
    });

    const input: LayerInputContext = {
        domain: 'code',
        taskIntent: 'review',
        retrieval: {
            candidates: [
                {
                    item: {
                        id: 'file-1',
                        domain: 'code',
                        source: { type: 'repo', location: 'src/payment.ts' },
                        payload: { text: 'function charge() { /* ... */ }' },
                        metadata: {
                            version: '1',
                            confidentiality: 'internal',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            lineage: [],
                        },
                    },
                    score: 0.9,
                },
            ],
            diagnostics: {},
        },
    };

    const result: LayerBuildResult[] = await Promise.all(
        pipeline.steps.map((step) => step.builder.build(input)),
    );

    return result.map((entry) => entry.layer);
}
