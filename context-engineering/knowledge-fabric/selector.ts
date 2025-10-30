import type {
    Candidate,
    RetrievalQuery,
} from '../../packages/context-os-core/src/interfaces.js';
import { createKnowledgeStore, type KnowledgeStore } from './store/index.js';

interface RuleSelectorOptions {
    intent: RetrievalQuery['taskIntent'];
    tags?: string[];
    maxResults?: number;
}

let storeInstance: Promise<KnowledgeStore> | null = null;

async function getStore(): Promise<KnowledgeStore> {
    if (!storeInstance) {
        storeInstance = createKnowledgeStore({
            config: { type: 'filesystem' },
        });
    }
    return storeInstance;
}

export async function loadRulesForIntent(
    options: RuleSelectorOptions,
): Promise<Candidate[]> {
    const store = await getStore();
    const { intent, tags = ['rule'], maxResults = 10 } = options;

    const domain = intent === 'review' ? 'code' : 'support';

    const matches = await store.query({
        domain,
        tags,
        limit: maxResults,
    });

    return matches.map((item) => ({
        item,
        score: 0.8,
        rationale: 'Knowledge rule loaded from fabric store.',
        metadata: { source: 'knowledge-fabric' },
    }));
}
