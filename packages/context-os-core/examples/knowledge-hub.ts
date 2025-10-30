import {
    CoreLayerBuilder,
    CatalogLayerBuilder,
    ActiveLayerBuilder,
    SequentialPackAssemblyPipeline,
} from '../src/index.js';
import type { LayerInputContext, ContextLayer } from '../src/interfaces.js';
import type { CoreLayerMaterializer } from '../src/builders/core-layer-builder.js';
import type { CatalogLayerMaterializer } from '../src/builders/catalog-layer-builder.js';
import type { ActiveLayerSelector } from '../src/builders/active-layer-builder.js';

class KnowledgeCoreMaterializer implements CoreLayerMaterializer {
    async materialize() {
        return {
            persona: {
                name: 'Atlas',
                role: 'knowledge navigator',
                description: 'Answers company questions using curated documents.',
            },
            instructions: [
                {
                    id: 'cite-sources',
                    text: 'Always cite the document title and revision when answering.',
                    critical: true,
                },
                {
                    id: 'handle-gaps',
                    text: 'If information is missing, say so and suggest contacting the document owner.',
                },
            ],
            notes: ['Summaries should be concise and reference document owners.'],
        };
    }
}

class KnowledgeCatalogMaterializer implements CatalogLayerMaterializer {
    async build(input: LayerInputContext) {
        const docs = input.retrieval?.candidates ?? [];
        const top = docs.slice(0, 5).map((candidate) => {
            const owner = candidate.item.metadata.ownerId ?? 'unknown owner';
            const title = candidate.item.metadata.title ?? candidate.item.source.location;
            return `• ${title} (owner: ${owner})`;
        });

        return {
            entries: [
                {
                    id: 'doc-overview',
                    title: 'Relevant knowledge articles',
                    summary: top.join('\n') || 'No matching documents.',
                },
            ],
        };
    }
}

class KnowledgeActiveSelector implements ActiveLayerSelector {
    async select(input: LayerInputContext) {
        const snippets = input.retrieval?.candidates?.slice(0, 3).map((candidate, index) => ({
            id: `snippet-${index}`,
            itemId: candidate.item.id,
            text: candidate.item.payload.text ?? 'No excerpt available.',
            metadata: {
                source: candidate.item.source.location,
                tags: candidate.item.metadata.tags,
            },
        })) ?? [];

        return {
            snippets,
            references: snippets.map((s) => ({ itemId: s.itemId })),
            resources: [],
        };
    }
}

export async function runKnowledgeHubExample(): Promise<ContextLayer[]> {
    const pipeline = new SequentialPackAssemblyPipeline({
        steps: [
            { builder: new CoreLayerBuilder({ materializer: new KnowledgeCoreMaterializer() }), description: 'Knowledge persona' },
            { builder: new CatalogLayerBuilder({ materializer: new KnowledgeCatalogMaterializer() }), description: 'Document summary' },
            { builder: new ActiveLayerBuilder({ selector: new KnowledgeActiveSelector() }), description: 'Key excerpts' },
        ],
    });

    const input: LayerInputContext = {
        domain: 'knowledge',
        taskIntent: 'answer-question',
        retrieval: {
            candidates: [
                {
                    item: {
                        id: 'doc-security-policy',
                        domain: 'knowledge',
                        source: { type: 'wiki', location: 'Security/Policy.md' },
                        payload: { text: 'All production access requires MFA and approval.' },
                        metadata: {
                            version: '2025-01-10',
                            title: 'Production Security Policy',
                            tags: ['security', 'operations'],
                            confidentiality: 'internal',
                            ownerId: 'security-team',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            lineage: [],
                        },
                    },
                    score: 0.92,
                },
            ],
            diagnostics: {},
        },
        metadata: {
            question: 'What are the requirements for production access?',
        },
    };

    const layers: ContextLayer[] = [];
    for (const step of pipeline.steps) {
        const result = await step.builder.build(input);
        layers.push(result.layer);
    }

    return layers;
}
