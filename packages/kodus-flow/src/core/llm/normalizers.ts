type TextLikeBlock = { type?: string; text?: unknown };

const shouldSkipBlock = (type?: string): boolean =>
    type === 'reasoning' || type === 'thinking';

const extractTextFromBlocks = (blocks: unknown[]): string => {
    return blocks
        .map((block) => {
            if (!block || typeof block !== 'object') return '';
            const typed = block as TextLikeBlock;
            if (shouldSkipBlock(typed.type)) return '';
            return typeof typed.text === 'string' ? typed.text : '';
        })
        .filter(Boolean)
        .join('');
};

export function normalizeLLMContent(content: unknown): string {
    if (typeof content === 'string') return content;

    // Handle typical LangChain-like response objects
    if (content && typeof content === 'object') {
        const c = content as Record<string, unknown>;
        // Direct content property
        if (typeof c.content === 'string') return c.content;

        // Standard content blocks accessor (LangChain v1)
        if (Array.isArray(c.contentBlocks)) {
            const text = extractTextFromBlocks(c.contentBlocks);
            if (text) return text;
        }

        // Array of blocks with { type, text }
        if (Array.isArray(c.content)) {
            return extractTextFromBlocks(c.content);
        }
    }

    // Some providers might put blocks at the top-level
    if (Array.isArray(content)) {
        return extractTextFromBlocks(content);
    }

    // Fallback
    return '';
}

export type HumanAiMessage = {
    type: 'system' | 'human' | 'ai';
    content: string;
    name?: string;
};

// Normalize generic chat messages (role-based) to providers that expect
// 'system' | 'human' | 'ai' in a 'type' field.
export function toHumanAiMessages(
    messages: Array<{ role?: string; content: string; name?: string }>,
): HumanAiMessage[] {
    return messages.map((m) => {
        const role = (m.role || '').toLowerCase();
        let type: HumanAiMessage['type'];
        if (role === 'system') type = 'system';
        else if (role === 'user' || role === 'human') type = 'human';
        else type = 'ai';
        return { type, content: m.content, name: m.name };
    });
}
