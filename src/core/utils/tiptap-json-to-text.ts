export function convertTiptapJSONToText(
    content: string | Record<string, unknown> | null | undefined,
): string {
    if (!content) {
        return '';
    }

    if (typeof content === 'string') {
        const trimmed = content.trim();
        if (trimmed.startsWith('{')) {
            try {
                return convertTiptapJSONToText(JSON.parse(trimmed));
            } catch {
                return content;
            }
        }
        return content;
    }

    if (typeof content === 'object') {
        let text = '';

        const traverse = (node: any): void => {
            if (!node || typeof node !== 'object') {
                return;
            }

            switch (node.type) {
                case 'text':
                    text += node.text ?? '';
                    return;
                case 'hardBreak':
                    text += '\n';
                    return;
                case 'mcpMention': {
                    const app = typeof node.attrs?.app === 'string' ? node.attrs.app : '';
                    const tool = typeof node.attrs?.tool === 'string' ? node.attrs.tool : '';
                    text += `@mcp<${app}|${tool}>`;
                    return;
                }
                default:
                    break;
            }

            if (Array.isArray(node.content)) {
                node.content.forEach(traverse);
                if (node.type === 'paragraph' || node.type === 'heading') {
                    text += '\n';
                }
            }
        };

        traverse(content);
        return text.replace(/\n{3,}/g, '\n\n').trimEnd();
    }

    return '';
}
