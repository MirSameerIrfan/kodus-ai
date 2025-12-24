import { default as Ajv } from 'ajv';
import { default as addFormats } from 'ajv-formats';
import {
    LangChainResponse,
    llmResponseSchema,
    PlanningResult,
    planningResultSchema,
} from '../types/allTypes.js';
import { createLogger } from '../../observability/index.js';
import { EnhancedJSONParser } from '../../utils/json-parser.js';

const ajvConstructor = Ajv as unknown as typeof Ajv.default;
const ajv = new ajvConstructor({
    allErrors: true,
    verbose: true,
    strict: false, // LLM responses might have extra fields
    coerceTypes: true, // Convert string numbers to numbers
    removeAdditional: 'failing', // Keep unknown fields but mark as failing
    // ✅ AJV PERFORMANCE: Optimize for large schemas
    code: { optimize: true },
    // ✅ AJV PERFORMANCE: Loop optimization for arrays
    loopRequired: 20, // Use loop for >20 required properties
    loopEnum: 20, // Use loop for >20 enum values
});

// Add format validators (email, uri, date-time, etc)
export const addFormatsFunction =
    addFormats as unknown as typeof addFormats.default;
addFormatsFunction(ajv);

const logger = createLogger('response-validator');

type TextLikeBlock = { type?: string; text?: unknown };

const shouldSkipBlock = (type?: string): boolean =>
    type === 'reasoning' || type === 'thinking';

const extractTextFromBlocks = (blocks: unknown[]): string => {
    const text = blocks
        .map((block) => {
            if (!block || typeof block !== 'object') return '';
            const typed = block as TextLikeBlock;
            if (shouldSkipBlock(typed.type)) return '';
            return typeof typed.text === 'string' ? typed.text : '';
        })
        .filter(Boolean)
        .join('\n');

    return text.trim();
};

/**
 * Extract content from various response formats
 */
function extractContent(response: unknown): string {
    // String response
    if (typeof response === 'string') {
        return response;
    }

    // LangChain response object
    if (typeof response === 'object' && response !== null) {
        const obj = response as Record<string, unknown>;

        // Standard content blocks accessor (LangChain v1)
        if (Array.isArray(obj.contentBlocks)) {
            const text = extractTextFromBlocks(obj.contentBlocks);
            if (text) return text;
        }

        // ✅ ENHANCED: Handle array content with text blocks (Claude/Anthropic format)
        if (Array.isArray(obj.content)) {
            const text = extractTextFromBlocks(obj.content);
            if (text) return text;
        }

        // Direct content field (string)
        if (typeof obj.content === 'string') {
            return obj.content;
        }

        // Message format
        if (obj.message && typeof obj.message === 'object') {
            const msg = obj.message as Record<string, unknown>;
            if (typeof msg.content === 'string') {
                return msg.content;
            }
            if (Array.isArray(msg.content)) {
                const text = extractTextFromBlocks(msg.content);
                if (text) return text;
            }
        }

        // Text field
        if (typeof obj.text === 'string') {
            return obj.text;
        }

        // Completion field
        if (typeof obj.completion === 'string') {
            return obj.completion;
        }
    }

    // Fallback to JSON string
    return JSON.stringify(response);
}

/**
 * Parse JSON from various formats (handles code blocks, etc) - Enhanced Version
 */
function parseJSON(content: string): unknown {
    const result = EnhancedJSONParser.parse(content);

    if (result === null) {
        throw new Error('Failed to parse JSON from response');
    }

    return result;
}

/**
 * Validate and parse planning response
 */
export function validatePlanningResponse(response: unknown): PlanningResult {
    try {
        // Extract content
        const content = extractContent(response);

        // Parse JSON
        const parsed = parseJSON(content);

        // Handle direct array response (list of steps)
        let planData: unknown = parsed;
        if (Array.isArray(parsed)) {
            planData = {
                strategy: 'plan-execute',
                goal: 'Inferred from steps',
                steps: parsed,
                reasoning: 'Steps provided as array',
            };
        }

        // Normalize plan/steps field
        if (typeof planData === 'object' && planData !== null) {
            const obj = planData as Record<string, unknown>;

            // ✅ FIX: Handle case where both plan and steps are empty
            if (obj.plan && obj.steps) {
                // If both exist, prefer steps and remove plan to satisfy oneOf
                if (Array.isArray(obj.steps) && Array.isArray(obj.plan)) {
                    if (obj.steps.length === 0 && obj.plan.length === 0) {
                        // Both empty - keep steps, remove plan
                        delete obj.plan;
                    } else if (obj.steps.length === 0 && obj.plan.length > 0) {
                        // Steps empty, plan has data - copy plan to steps
                        obj.steps = obj.plan;
                        delete obj.plan;
                    } else if (obj.steps.length > 0 && obj.plan.length === 0) {
                        // Steps has data, plan empty - remove plan
                        delete obj.plan;
                    }
                    // If both have data, prefer steps
                }
            }
            // If has 'plan' but not 'steps', copy plan to steps
            else if (obj.plan && !obj.steps) {
                obj.steps = obj.plan;
                delete obj.plan;
            }
            // If has 'steps' but not 'plan', keep as is
            else if (obj.steps && !obj.plan) {
                // Already correct format
            }

            // Normalize reasoning to string
            if (Array.isArray(obj.reasoning)) {
                obj.reasoning = obj.reasoning.join('\n');
            }
        }

        // Validate with AJV
        if (validatePlanningResultSchema(planData)) {
            const validData = planData as unknown as PlanningResult;
            logger.debug({
                message: 'Planning response validated successfully',
                context: 'validatePlanningResponse',

                metadata: {
                    strategy: validData.strategy,
                    stepsCount: validData.steps?.length || 0,
                },
            });
            return validData;
        }

        // Validation failed - log errors and attempt recovery
        // ✅ AJV BEST PRACTICE: Copy errors before they're overwritten
        const validationErrors = validatePlanningResultSchema.errors
            ? [...validatePlanningResultSchema.errors]
            : [];

        logger.warn({
            message: 'Planning response validation failed',
            context: 'validatePlanningResponse',

            metadata: {
                errors: validationErrors,
                parsedData: planData,
            },
        });

        // Attempt to recover with defaults
        const planDataRecord = planData as Record<string, unknown>;
        const recovered: PlanningResult = {
            strategy: (planDataRecord?.strategy as string) || 'unknown',
            goal: (planDataRecord?.goal as string) || 'Unknown goal',
            steps:
                (planDataRecord?.steps as PlanningResult['steps']) ||
                (planDataRecord?.plan as PlanningResult['steps']) ||
                [],
            reasoning:
                (planDataRecord?.reasoning as string) ||
                'No reasoning provided',
        };

        // Validate recovered data
        if (validatePlanningResultSchema(recovered)) {
            logger.log({
                message: 'Successfully recovered planning response',
                context: 'validatePlanningResponse',

                metadata: {
                    strategy: recovered.strategy,
                    stepsCount: recovered.steps.length,
                },
            });
            return recovered;
        }

        // ✅ AJV BEST PRACTICE: Copy errors before using
        const recoveryErrors = validatePlanningResultSchema.errors
            ? [...validatePlanningResultSchema.errors]
            : [];

        throw new Error(
            `Validation failed after recovery: ${JSON.stringify(recoveryErrors)}`,
        );
    } catch (error) {
        logger.error({
            message: 'Failed to validate planning response',
            context: 'validatePlanningResponse',
            error: error as Error,

            metadata: {
                responseType: typeof response,
                responsePreview: JSON.stringify(response).substring(0, 200),
            },
        });

        // Return minimal valid response
        return {
            strategy: 'error-recovery',
            goal: 'Failed to parse response',
            steps: [],
            reasoning: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Validate generic LLM response
 */
export function validateLLMResponse(response: unknown): LangChainResponse {
    try {
        // Handle string response
        if (typeof response === 'string') {
            return { content: response };
        }

        // Validate with AJV
        if (validateLLMResponseSchema(response)) {
            return response as unknown as LangChainResponse;
        }

        // Extract content for simple response
        const content = extractContent(response);
        return { content };
    } catch (error) {
        logger.error({
            message: 'Failed to validate LLM response',
            context: 'validateLLMResponse',
            error: error as Error,
        });
        return { content: 'Failed to parse LLM response' };
    }
}

/**
 * Get detailed validation errors in human-readable format
 */
export function getValidationErrors(validator: {
    errors?: Array<{ instancePath?: string; message?: string }>;
}): string[] {
    if (!validator.errors) return [];

    return validator.errors.map((err) => {
        const path = err.instancePath || 'root';
        const message = err.message || 'Unknown error';
        return `${path}: ${message}`;
    });
}

/**
 * Validate any JSON against a custom schema
 */
export function validateCustomSchema(data: unknown, schema: object): boolean {
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
        logger.warn({
            message: 'Custom schema validation failed',
            context: 'validateCustomSchema',

            metadata: {
                errors: validate.errors,
                data,
            },
        });
    }

    return valid;
}

export const validatePlanningResultSchema = ajv.compile(planningResultSchema);
export const validateLLMResponseSchema = ajv.compile(llmResponseSchema);
