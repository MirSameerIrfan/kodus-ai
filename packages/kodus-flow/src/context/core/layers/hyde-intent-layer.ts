import type {
    ContextLayer,
    ContextLayerBuilder,
    ContextLayerKind,
    LayerBuildOptions,
    LayerBuildResult,
    LayerInputContext,
    LayerResidence,
    RetrievalResult,
} from '../interfaces.js';

export interface HyDEGenerationInput {
    intent: string;
    retrieval: RetrievalResult;
    metadata?: Record<string, unknown>;
}

export interface HyDEGenerationOutput {
    document: string;
    expandedQueries?: string[];
    references?: ContextLayer['references'];
    tokensEstimate?: number;
    diagnostics?: Record<string, unknown>;
}

export interface HyDEGenerator {
    generate(input: HyDEGenerationInput): Promise<HyDEGenerationOutput>;
}

export interface HyDEIntentLayerOptions {
    stage?: Extract<ContextLayerKind, 'core' | 'catalog' | 'active'>;
    layerKind?: ContextLayerKind;
    priority?: number;
    residence?: LayerResidence;
    idPrefix?: string;
}

export class HyDEIntentLayerBuilder implements ContextLayerBuilder {
    readonly stage: Extract<ContextLayerKind, 'core' | 'catalog' | 'active'>;

    constructor(
        private readonly generator: HyDEGenerator = new SimpleHyDEGenerator(),
        private readonly options: HyDEIntentLayerOptions = {},
    ) {
        this.stage = (options.stage ?? 'catalog') as Extract<
            ContextLayerKind,
            'core' | 'catalog' | 'active'
        >;
    }

    async build(
        input: LayerInputContext,
        options?: LayerBuildOptions,
    ): Promise<LayerBuildResult> {
        const generation = await this.generator.generate({
            intent: input.taskIntent,
            retrieval: input.retrieval,
            metadata: input.metadata,
        });

        const references =
            generation.references?.length && generation.references.length > 0
                ? generation.references
                : this.buildReferencesFromRetrieval(input);

        const layer: ContextLayer = {
            id: `${this.options.idPrefix ?? 'hyde'}::${input.domain}`,
            kind: this.options.layerKind ?? this.stage,
            priority:
                options?.priority ??
                this.options.priority ??
                (this.stage === 'core' ? 10 : 50),
            residence:
                options?.residence ?? this.options.residence ?? 'on_demand',
            tokens:
                generation.tokensEstimate ??
                this.estimateTokens(generation.document),
            content: {
                intent: input.taskIntent,
                hypotheticalDocument: generation.document,
                expandedQueries: generation.expandedQueries ?? [],
                diagnostics: generation.diagnostics,
            },
            references,
            metadata: {
                generator: this.generator.constructor.name,
            },
        };

        return {
            layer,
            diagnostics: {
                notes: 'HyDE intent expansion layer',
                tokensAfter: layer.tokens,
            },
        };
    }

    private buildReferencesFromRetrieval(
        input: LayerInputContext,
    ): ContextLayer['references'] {
        return input.retrieval.candidates.slice(0, 10).map((candidate) => ({
            itemId: candidate.item.id,
            sliceId: candidate.slices?.[0]?.metadata?.sliceId as
                | string
                | undefined,
        }));
    }

    private estimateTokens(text: string): number {
        if (!text) {
            return 0;
        }

        const approxToken = Math.max(1, Math.ceil(text.length / 4));
        return approxToken;
    }
}

interface SimpleGeneratorConfig {
    maxCandidates?: number;
    includeSlices?: boolean;
}

export class SimpleHyDEGenerator implements HyDEGenerator {
    constructor(private readonly config: SimpleGeneratorConfig = {}) {}

    async generate(input: HyDEGenerationInput): Promise<HyDEGenerationOutput> {
        const maxCandidates = this.config.maxCandidates ?? 5;
        const topCandidates = input.retrieval.candidates.slice(
            0,
            maxCandidates,
        );

        const sections = topCandidates.map((candidate, index) => {
            const parts = [
                `Candidate #${index + 1} (score=${candidate.score.toFixed(3)})`,
                `Title: ${candidate.item.metadata.title ?? candidate.item.id}`,
            ];

            if (candidate.item.payload.text) {
                parts.push(
                    `Excerpt: ${candidate.item.payload.text
                        .trim()
                        .slice(0, 280)}`,
                );
            }

            if (this.config.includeSlices && candidate.slices?.length) {
                parts.push(
                    `Slices: ${candidate.slices
                        .map((slice) => slice.summary ?? '')
                        .join(' | ')}`,
                );
            }

            return parts.join('\n');
        });

        const document = [
            `Intent: ${input.intent}`,
            `Context summary generated via HyDE (synthetic document to guide retrieval):`,
            ...sections,
        ].join('\n\n');

        return {
            document,
            expandedQueries: [
                input.intent,
                `${input.intent} impact on dependencies`,
                `${input.intent} historical regressions`,
            ],
            references: topCandidates.map((candidate) => ({
                itemId: candidate.item.id,
                sliceId: candidate.slices?.[0]?.metadata?.sliceId as
                    | string
                    | undefined,
            })),
            tokensEstimate: Math.ceil(document.length / 4),
        };
    }
}
