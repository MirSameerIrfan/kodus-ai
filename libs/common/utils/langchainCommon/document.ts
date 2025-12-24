import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import 'dotenv/config';

interface OpenAIEmbeddingResponse {
    data: Array<{
        embedding: number[];
        index: number;
        object: string;
    }>;
    model: string;
    object: string;
}

/**
 * Creates a new document object based on the provided formatted data.
 *
 * @param {any} formattedData - The formatted data used to create the document.
 * @return {Document} The newly created document Langchain object Type.
 */
const createDocument = (
    formattedData: any,
    metaData?: Record<string, any>,
): Document => {
    return new Document({
        pageContent: formattedData,
        metadata: { ...metaData },
    });
};

const estimateTokenCount = (text: string) => {
    // Convert the string to a Blob and get its size in bytes
    const byteCount = new Blob([text]).size;

    // Estimate token count based on average of 4 bytes per token
    return Math.floor(byteCount / 4);
};

let embedder: OpenAIEmbeddings | null = null;

const getEmbedder = (options?: {
    model?: string;
    apiKey?: string;
}): OpenAIEmbeddings => {
    if (!embedder) {
        const defaultOptions = {
            model: 'text-embedding-3-small',
            apiKey: process.env.API_OPEN_AI_API_KEY,
        };

        const config = { ...defaultOptions, ...options };

        embedder = new OpenAIEmbeddings({
            apiKey: config.apiKey,
            model: config.model,
        });
    }

    return embedder;
};

const getOpenAIEmbedding = async (
    input: string,
    options?: {
        model?: string;
        apiKey?: string;
    },
): Promise<OpenAIEmbeddingResponse> => {
    const defaultOptions = {
        model: 'text-embedding-3-small',
        apiKey: process.env.API_OPEN_AI_API_KEY,
    };

    const config = { ...defaultOptions, ...options };

    const embedder = getEmbedder(config);

    const embeddingVector = await embedder.embedQuery(input);

    return {
        data: [
            {
                embedding: embeddingVector,
                index: 0,
                object: 'embedding',
            },
        ],
        model: config.model,
        object: 'list',
    };
};

export { createDocument, estimateTokenCount, getOpenAIEmbedding };
