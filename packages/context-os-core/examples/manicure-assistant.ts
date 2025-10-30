import {
    CoreLayerBuilder,
    CatalogLayerBuilder,
    ActiveLayerBuilder,
    SequentialPackAssemblyPipeline,
} from '../src/index.js';
import type { ContextLayer, LayerInputContext } from '../src/interfaces.js';
import type { CoreLayerMaterializer } from '../src/builders/core-layer-builder.js';
import type { CatalogLayerMaterializer } from '../src/builders/catalog-layer-builder.js';
import type { ActiveLayerSelector } from '../src/builders/active-layer-builder.js';

/**
 * Core instructions for a beauty-salon booking agent.
 */
class ManicureCoreMaterializer implements CoreLayerMaterializer {
    async materialize(): Promise<any> {
        return {
            persona: {
                name: 'Luna, Nail Concierge',
                role: 'appointment assistant',
                description:
                    'Helps clients pick services and schedule manicure appointments.',
            },
            instructions: [
                {
                    id: 'intent',
                    text: 'Always confirm preferred date, time, and nail service before finalizing.',
                    critical: true,
                },
                {
                    id: 'upsell',
                    text: 'Offer add-ons like gel polish or nail art when relevant.',
                },
            ],
            constraints: [
                {
                    id: 'no-medical',
                    text: 'Do not give medical advice. Suggest visiting a dermatologist for health concerns.',
                    critical: true,
                },
            ],
            notes: [
                'Respond in a warm, friendly tone and confirm availability.',
            ],
        };
    }
}

class ManicureCatalogMaterializer implements CatalogLayerMaterializer {
    async build(input: LayerInputContext) {
        const services = input.metadata?.availableServices ?? [];
        const technicians = input.metadata?.technicians ?? [];
        return {
            entries: [
                {
                    id: 'services',
                    title: 'Available services',
                    summary: services.join(', ') || 'Basic manicure',
                },
                {
                    id: 'team',
                    title: 'Technicians on duty',
                    summary:
                        technicians.join(', ') ||
                        'Team information unavailable',
                },
            ],
            insights: [
                'Mention discounts for weekday afternoons if client is flexible.',
            ],
        };
    }
}

class ManicureActiveSelector implements ActiveLayerSelector {
    async select(input: LayerInputContext) {
        const clientHistory = input.metadata?.clientHistory as
            | { lastService: string; favoriteTechnician: string }
            | undefined;

        return {
            snippets: clientHistory
                ? [
                      {
                          id: 'history',
                          itemId: 'client-history',
                          text: `Last visit: ${clientHistory.lastService}. Preferred technician: ${clientHistory.favoriteTechnician}.`,
                          metadata: { source: 'CRM' },
                      },
                  ]
                : [],
            references: [],
            resources: [],
        };
    }
}

export async function runManicureAssistantExample(): Promise<ContextLayer[]> {
    const pipeline = new SequentialPackAssemblyPipeline({
        steps: [
            {
                builder: new CoreLayerBuilder({
                    materializer: new ManicureCoreMaterializer(),
                }),
                description: 'Persona & rules',
            },
            {
                builder: new CatalogLayerBuilder({
                    materializer: new ManicureCatalogMaterializer(),
                }),
                description: 'Salon data',
            },
            {
                builder: new ActiveLayerBuilder({
                    selector: new ManicureActiveSelector(),
                }),
                description: 'Client snippets',
            },
        ],
    });

    const input: LayerInputContext = {
        domain: 'customer-service',
        taskIntent: 'book-appointment',
        retrieval: { candidates: [], diagnostics: {} },
        metadata: {
            availableServices: [
                'Classic manicure',
                'Gel manicure',
                'Spa manicure',
            ],
            technicians: ['Ana', 'Bia', 'Carla'],
            clientHistory: {
                lastService: 'Gel manicure (3 weeks ago)',
                favoriteTechnician: 'Ana',
            },
        },
    };

    const layers: ContextLayer[] = [];
    for (const step of pipeline.steps) {
        const result = await step.builder.build(input);
        layers.push(result.layer);
    }

    return layers;
}
