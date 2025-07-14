/**
 * @module core/llm/direct-llm-adapter
 * @description Direct LLM Adapter - Aceita instâncias LangChain diretamente sem conversão
 *
 * FILOSOFIA:
 * ✅ Interface simples que aceita LangChain diretamente
 * ✅ Zero overhead de conversão
 * ✅ Máxima performance
 * ✅ Compatibilidade nativa com LangChain
 * ✅ Mantém todas as técnicas de planning/routing
 */

import { createLogger } from '../../observability/index.js';
import { EngineError } from '../errors.js';

// ──────────────────────────────────────────────────────────────────────────────
// 📋 LANGCHAIN NATIVE TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface LangChainMessage {
    role: string;
    content: string;
    name?: string;
    toolCallId?: string;
    toolCalls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        };
    }>;
}

export interface LangChainOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    stream?: boolean;
    tools?: unknown[];
    toolChoice?: string;
}

export interface LangChainResponse {
    content: string;
    toolCalls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        };
    }>;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
    additionalKwargs?: Record<string, unknown>;
}

export interface LangChainLLM {
    call(
        messages: LangChainMessage[],
        options?: LangChainOptions,
    ): Promise<LangChainResponse | string>;
    stream?(
        messages: LangChainMessage[],
        options?: LangChainOptions,
    ): AsyncGenerator<LangChainResponse | string>;
    name?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 PLANNING & ROUTING TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanningTechnique {
    name: string;
    description: string;
    systemPrompt: string;
    userPromptTemplate: string;
    responseParser: (response: string) => PlanningResult;
    options?: LangChainOptions;
}

export interface RoutingTechnique {
    name: string;
    description: string;
    systemPrompt: string;
    userPromptTemplate: string;
    responseParser: (response: string) => RoutingResult;
    options?: LangChainOptions;
}

export interface PlanningResult {
    strategy: string;
    goal: string;
    steps: Array<{
        id: string;
        description: string;
        tool?: string;
        arguments?: Record<string, unknown>;
        dependencies?: string[];
        type: 'analysis' | 'action' | 'decision' | 'observation';
    }>;
    reasoning: string;
    complexity: 'simple' | 'medium' | 'complex';
    estimatedTime?: number;
}

export interface RoutingResult {
    strategy: string;
    selectedTool: string;
    confidence: number;
    reasoning: string;
    alternatives?: Array<{
        tool: string;
        confidence: number;
        reason: string;
    }>;
}

// ──────────────────────────────────────────────────────────────────────────────
// 🚀 DIRECT LLM ADAPTER IMPLEMENTATION
// ──────────────────────────────────────────────────────────────────────────────

export class DirectLLMAdapter {
    private llm: LangChainLLM;
    private logger = createLogger('direct-llm-adapter');
    private planningTechniques = new Map<string, PlanningTechnique>();
    private routingStrategies = new Map<string, RoutingTechnique>();

    constructor(langchainLLM: LangChainLLM) {
        this.llm = langchainLLM;
        this.initializePlanningTechniques();
        this.initializeRoutingStrategies();

        this.logger.info('Direct LLM adapter initialized', {
            llmName: langchainLLM.name || 'unknown-llm',
            hasStreaming: typeof langchainLLM.stream === 'function',
        });
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // 🎯 PLANNING INTERFACE (DIRETO COM LANGCHAIN)
    // ──────────────────────────────────────────────────────────────────────────────

    async createPlan(
        goal: string,
        technique: string = 'cot',
        context?: {
            availableTools?: string[];
            previousPlans?: PlanningResult[];
            constraints?: string[];
        },
    ): Promise<PlanningResult> {
        const planningTechnique = this.planningTechniques.get(technique);
        if (!planningTechnique) {
            throw new EngineError(
                'LLM_ERROR',
                `Planning technique '${technique}' not found`,
            );
        }

        const messages: LangChainMessage[] = [
            {
                role: 'system',
                content: planningTechnique.systemPrompt,
            },
            {
                role: 'user',
                content: this.formatUserPrompt(
                    planningTechnique.userPromptTemplate,
                    goal,
                    context,
                ),
            },
        ];

        try {
            this.logger.debug('Creating plan with LangChain LLM', {
                technique,
                goal,
                contextProvided: !!context,
            });

            // ✅ CHAMADA DIRETA - SEM CONVERSÃO
            const response = await this.llm.call(
                messages,
                planningTechnique.options,
            );

            // Handle both string and object responses from LangChain
            const content =
                typeof response === 'string' ? response : response.content;

            const result = planningTechnique.responseParser(content);

            this.logger.debug('Plan created successfully', {
                strategy: result.strategy,
                stepsCount: result.steps.length,
                complexity: result.complexity,
            });

            return result;
        } catch (error) {
            this.logger.error(
                'Planning failed',
                error instanceof Error ? error : new Error('Unknown error'),
            );
            throw new EngineError(
                'LLM_ERROR',
                `Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    async routeToTool(
        input: string | Record<string, unknown>,
        availableTools: string[],
        strategy: string = 'llm_decision',
    ): Promise<RoutingResult> {
        const routingStrategy = this.routingStrategies.get(strategy);
        if (!routingStrategy) {
            throw new EngineError(
                'LLM_ERROR',
                `Routing strategy '${strategy}' not found`,
            );
        }

        const messages: LangChainMessage[] = [
            {
                role: 'system',
                content: routingStrategy.systemPrompt,
            },
            {
                role: 'user',
                content: this.formatUserPrompt(
                    routingStrategy.userPromptTemplate,
                    input,
                    { availableTools },
                ),
            },
        ];

        try {
            this.logger.debug('Routing with LangChain LLM', {
                strategy,
                input:
                    typeof input === 'object' ? JSON.stringify(input) : input,
                availableToolsCount: availableTools.length,
            });

            // ✅ CHAMADA DIRETA - SEM CONVERSÃO
            const response = await this.llm.call(
                messages,
                routingStrategy.options,
            );

            // Handle both string and object responses from LangChain
            const content =
                typeof response === 'string' ? response : response.content;

            const result = routingStrategy.responseParser(content);

            this.logger.debug('Routing completed successfully', {
                selectedTool: result.selectedTool,
                confidence: result.confidence,
                strategy: result.strategy,
            });

            return result;
        } catch (error) {
            this.logger.error(
                'Routing failed',
                error instanceof Error ? error : new Error('Unknown error'),
            );
            throw new EngineError(
                'LLM_ERROR',
                `Routing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // 🧠 PLANNING TECHNIQUES IMPLEMENTATION
    // ──────────────────────────────────────────────────────────────────────────────

    private initializePlanningTechniques() {
        // Chain of Thought (CoT)
        this.planningTechniques.set('cot', {
            name: 'Chain of Thought',
            description: 'Step-by-step reasoning with explicit thought process',
            systemPrompt: `You are an expert planning assistant that uses Chain of Thought reasoning.
Your job is to break down complex goals into logical, sequential steps.

Instructions:
1. Think through the problem step by step
2. Identify the sequence of actions needed
3. Consider dependencies between steps
4. Provide clear reasoning for each step

Always respond in JSON format with the following structure:
{
  "strategy": "cot",
  "goal": "original goal",
  "steps": [
    {
      "id": "step_1",
      "description": "Step description",
      "tool": "tool_name",
      "arguments": {},
      "dependencies": [],
      "type": "analysis|action|decision|observation"
    }
  ],
  "reasoning": "your step-by-step reasoning",
  "complexity": "simple|medium|complex"
}`,
            userPromptTemplate: `Goal: {goal}

Available tools: {availableTools}
Context: {context}

Please create a step-by-step plan using Chain of Thought reasoning.`,
            responseParser: this.parseStandardPlanningResponse.bind(this),
            options: {
                temperature: 0.3,
                maxTokens: 1000,
            },
        });

        // Tree of Thoughts (ToT)
        this.planningTechniques.set('tot', {
            name: 'Tree of Thoughts',
            description:
                'Explores multiple reasoning paths and selects the best approach',
            systemPrompt: `You are an expert planning assistant that uses Tree of Thoughts reasoning.
Your job is to explore multiple possible approaches and select the best one.

Instructions:
1. Generate multiple possible approaches (branches)
2. Evaluate each approach's merits
3. Select the best approach based on criteria
4. Provide detailed reasoning for your selection

Always respond in JSON format with the following structure:
{
  "strategy": "tot",
  "goal": "original goal",
  "steps": [
    {
      "id": "step_1",
      "description": "Step description",
      "tool": "tool_name",
      "arguments": {},
      "dependencies": [],
      "type": "analysis|action|decision|observation"
    }
  ],
  "reasoning": "your reasoning including alternative approaches considered",
  "complexity": "simple|medium|complex"
}`,
            userPromptTemplate: `Goal: {goal}

Available tools: {availableTools}
Context: {context}

Please create a plan using Tree of Thoughts reasoning. Consider multiple approaches and select the best one.`,
            responseParser: this.parseStandardPlanningResponse.bind(this),
            options: {
                temperature: 0.5,
                maxTokens: 1500,
            },
        });

        // ReAct (Reasoning + Acting)
        this.planningTechniques.set('react', {
            name: 'ReAct',
            description:
                'Combines reasoning with acting in an iterative process',
            systemPrompt: `You are an expert planning assistant that uses ReAct (Reasoning + Acting) methodology.
Your job is to create plans that combine reasoning with actions in an iterative process.

Instructions:
1. Alternate between reasoning and acting
2. Each action should be followed by observation
3. Use observations to inform next reasoning step
4. Continue until goal is achieved

Always respond in JSON format with the following structure:
{
  "strategy": "react",
  "goal": "original goal",
  "steps": [
    {
      "id": "step_1",
      "description": "Step description",
      "tool": "tool_name",
      "arguments": {},
      "dependencies": [],
      "type": "analysis|action|decision|observation"
    }
  ],
  "reasoning": "your reasoning about the iterative process",
  "complexity": "simple|medium|complex"
}`,
            userPromptTemplate: `Goal: {goal}

Available tools: {availableTools}
Context: {context}

Please create a plan using ReAct methodology. Alternate between reasoning and acting.`,
            responseParser: this.parseStandardPlanningResponse.bind(this),
            options: {
                temperature: 0.4,
                maxTokens: 1200,
            },
        });

        // OODA Loop (Observe, Orient, Decide, Act)
        this.planningTechniques.set('ooda', {
            name: 'OODA Loop',
            description: 'Military-inspired decision making process',
            systemPrompt: `You are an expert planning assistant that uses OODA Loop methodology.
Your job is to create plans following the Observe, Orient, Decide, Act cycle.

Instructions:
1. OBSERVE: Gather information about the current situation
2. ORIENT: Analyze and synthesize the information
3. DECIDE: Choose the best course of action
4. ACT: Execute the decision
5. Loop back to OBSERVE for next iteration

Always respond in JSON format with the following structure:
{
  "strategy": "ooda",
  "goal": "original goal",
  "steps": [
    {
      "id": "step_1",
      "description": "Step description",
      "tool": "tool_name",
      "arguments": {},
      "dependencies": [],
      "type": "analysis|action|decision|observation"
    }
  ],
  "reasoning": "your reasoning following OODA methodology",
  "complexity": "simple|medium|complex"
}`,
            userPromptTemplate: `Goal: {goal}

Available tools: {availableTools}
Context: {context}

Please create a plan using OODA Loop methodology. Follow the Observe, Orient, Decide, Act cycle.`,
            responseParser: this.parseStandardPlanningResponse.bind(this),
            options: {
                temperature: 0.3,
                maxTokens: 1000,
            },
        });
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // 🔀 ROUTING STRATEGIES IMPLEMENTATION
    // ──────────────────────────────────────────────────────────────────────────────

    private initializeRoutingStrategies() {
        // LLM-based decision routing
        this.routingStrategies.set('llm_decision', {
            name: 'LLM Decision',
            description:
                'Use LLM to intelligently route based on input analysis',
            systemPrompt: `You are an expert routing assistant that analyzes input and selects the most appropriate tool.

Instructions:
1. Analyze the input content and intent
2. Consider the capabilities of available tools
3. Select the best tool for the task
4. Provide confidence score and reasoning
5. Suggest alternatives if applicable

Always respond in JSON format with the following structure:
{
  "strategy": "llm_decision",
  "selectedTool": "tool_name",
  "confidence": 0.95,
  "reasoning": "detailed reasoning for selection",
  "alternatives": [
    {
      "tool": "alternative_tool",
      "confidence": 0.8,
      "reason": "why this could work"
    }
  ]
}`,
            userPromptTemplate: `Input: {input}

Available tools: {availableTools}

Please analyze the input and select the most appropriate tool.`,
            responseParser: this.parseRoutingResponse.bind(this),
            options: {
                temperature: 0.2,
                maxTokens: 500,
            },
        });

        // Semantic similarity routing
        this.routingStrategies.set('semantic_similarity', {
            name: 'Semantic Similarity',
            description:
                'Route based on semantic similarity between input and tool descriptions',
            systemPrompt: `You are an expert routing assistant that uses semantic similarity to match inputs with tools.

Instructions:
1. Analyze the semantic meaning of the input
2. Compare with tool descriptions and capabilities
3. Calculate similarity scores
4. Select tool with highest semantic match
5. Provide reasoning based on semantic analysis

Always respond in JSON format with the following structure:
{
  "strategy": "semantic_similarity",
  "selectedTool": "tool_name",
  "confidence": 0.95,
  "reasoning": "semantic analysis and similarity reasoning",
  "alternatives": [
    {
      "tool": "alternative_tool",
      "confidence": 0.8,
      "reason": "semantic similarity reason"
    }
  ]
}`,
            userPromptTemplate: `Input: {input}

Available tools: {availableTools}

Please analyze semantic similarity and select the most appropriate tool.`,
            responseParser: this.parseRoutingResponse.bind(this),
            options: {
                temperature: 0.1,
                maxTokens: 400,
            },
        });
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // 🔧 HELPER METHODS
    // ──────────────────────────────────────────────────────────────────────────────

    private formatUserPrompt(
        template: string,
        primary: string | Record<string, unknown>,
        context?: Record<string, unknown>,
    ): string {
        let formatted = template.replace('{goal}', String(primary));
        formatted = formatted.replace('{input}', JSON.stringify(primary));

        if (context?.availableTools) {
            formatted = formatted.replace(
                '{availableTools}',
                (context.availableTools as string[]).join(', '),
            );
        }

        formatted = formatted.replace(
            '{context}',
            JSON.stringify(context || {}),
        );
        return formatted;
    }

    /**
     * Clean JSON response from markdown code blocks
     */
    private cleanJsonResponse(response: string): string {
        let cleaned = response.trim();

        // Remove opening code block markers
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.substring(3);
        }

        // Remove closing code block markers
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.substring(0, cleaned.length - 3);
        }

        // Final trim
        cleaned = cleaned.trim();

        return cleaned;
    }

    private parseStandardPlanningResponse(response: string): PlanningResult {
        try {
            // Clean response from markdown code blocks
            const cleanedResponse = this.cleanJsonResponse(response);
            const parsed = JSON.parse(cleanedResponse);
            return {
                strategy: parsed.strategy || 'unknown',
                goal: parsed.goal || '',
                steps: parsed.steps || [],
                reasoning: parsed.reasoning || '',
                complexity: parsed.complexity || 'medium',
            };
        } catch (error) {
            this.logger.error(
                'Failed to parse planning response',
                error instanceof Error ? error : new Error('Unknown error'),
            );
            return {
                strategy: 'fallback',
                goal: '',
                steps: [],
                reasoning: 'Failed to parse LLM response',
                complexity: 'medium',
            };
        }
    }

    private parseRoutingResponse(response: string): RoutingResult {
        try {
            // Clean response from markdown code blocks
            const cleanedResponse = this.cleanJsonResponse(response);
            const parsed = JSON.parse(cleanedResponse);
            return {
                strategy: parsed.strategy || 'unknown',
                selectedTool: parsed.selectedTool || '',
                confidence: parsed.confidence || 0.5,
                reasoning: parsed.reasoning || '',
                alternatives: parsed.alternatives || [],
            };
        } catch (error) {
            this.logger.error(
                'Failed to parse routing response',
                error instanceof Error ? error : new Error('Unknown error'),
            );
            return {
                strategy: 'fallback',
                selectedTool: '',
                confidence: 0.1,
                reasoning: 'Failed to parse LLM response',
            };
        }
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // 📊 PROVIDER MANAGEMENT
    // ──────────────────────────────────────────────────────────────────────────────

    getLLM(): LangChainLLM {
        return this.llm;
    }

    setLLM(llm: LangChainLLM): void {
        this.llm = llm;
        this.logger.info('LangChain LLM updated', { name: llm.name });
    }

    // ✅ COMPATIBILIDADE COM SDKOrchestrator
    getProvider(): { name: string } {
        return {
            name: this.llm.name || 'unknown-llm',
        };
    }

    getAvailableTechniques(): string[] {
        return Array.from(this.planningTechniques.keys());
    }

    getAvailableRoutingStrategies(): string[] {
        return Array.from(this.routingStrategies.keys());
    }

    supportsStreaming(): boolean {
        return typeof this.llm.stream === 'function';
    }

    getName(): string {
        return this.llm.name || 'unknown-llm';
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// 🏭 FACTORY FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

export function createDirectLLMAdapter(
    langchainLLM: LangChainLLM,
): DirectLLMAdapter {
    return new DirectLLMAdapter(langchainLLM);
}

/**
 * Helper para migração de código existente
 */
export function createLLMAdapter(langchainLLM: LangChainLLM): DirectLLMAdapter {
    return createDirectLLMAdapter(langchainLLM);
}
