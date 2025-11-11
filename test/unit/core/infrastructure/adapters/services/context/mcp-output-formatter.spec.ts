import { formatMCPOutput } from '@/core/infrastructure/adapters/services/context/mcp-output-formatter';

const parseJSON = (value: string): unknown | null => {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

describe('formatMCPOutput', () => {
    it('converte conteúdo estruturado textual em bloco JSON legível', () => {
        const output = formatMCPOutput(
            {
                content: [
                    {
                        type: 'text',
                        text: '{ "success": true, "items": [1, 2, 3] }',
                    },
                ],
            },
            parseJSON,
        );

        expect(output).toContain('```mcp-result');
        expect(output).toContain('"success": true');
        expect(output).not.toContain('\\"');
    });

    it('mantém texto simples quando não é JSON', () => {
        const output = formatMCPOutput('plain text output', parseJSON);

        expect(output).toBe('plain text output');
    });
});
