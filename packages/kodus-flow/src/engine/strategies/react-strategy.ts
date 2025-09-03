import { LLMAdapter, AgentInputEnum } from '../../core/types/allTypes.js';
import { createLogger } from '../../observability/index.js';
import { BaseExecutionStrategy } from './strategy-interface.js';
import { SharedStrategyMethods } from './shared-methods.js';
import type {
    StrategyExecutionContext,
    ExecutionResult,
    ExecutionStep,
    AgentAction,
    ActionResult,
    AgentThought,
    ResultAnalysis,
} from './types.js';
import { StrategyPromptFactory } from './prompts/index.js';
import { ContextService } from '../../core/contextNew/index.js';
import { EnhancedJSONParser } from '../../utils/json-parser.js';

export class ReActStrategy extends BaseExecutionStrategy {
    private readonly logger = createLogger('react-strategy');
    private readonly promptFactory: StrategyPromptFactory;

    private readonly config: {
        maxIterations: number;
        maxToolCalls: number;
        maxExecutionTime: number;
        stepTimeout: number;
    };

    constructor(
        private llmAdapter: LLMAdapter,
        options: Partial<{
            llmAdapter: LLMAdapter;
            maxIterations: number;
            maxToolCalls: number;
            maxExecutionTime: number;
            stepTimeout: number;
        }> = {},
    ) {
        super();

        const defaultConfig = {
            maxIterations: 10,
            maxToolCalls: 20,
            maxExecutionTime: 300000, // 5 minutos
            stepTimeout: 60000, // 1 minuto por step
        };

        this.promptFactory = new StrategyPromptFactory();
        this.config = { ...defaultConfig, ...options };

        this.logger.info('🎯 ReAct Strategy initialized', {
            config: this.config,
        });
    }

    async execute(context: StrategyExecutionContext): Promise<ExecutionResult> {
        const startTime = Date.now();
        const steps: ExecutionStep[] = [];
        let iteration = 0;
        let toolCallsCount = 0;

        const threadId = context.agentContext.thread?.id;
        if (!threadId) {
            throw new Error('ThreadId required for ContextService operations');
        }

        try {
            this.validateContext(context);

            this.logger.debug('🚀 ReAct strategy started', { threadId });

            while (iteration < this.config.maxIterations) {
                // 🔥 FORÇA FINAL ANSWER na última iteração se não tiver resposta final
                const isLastIteration =
                    iteration === this.config.maxIterations - 1;
                const hasFinalAnswer = steps.some(
                    (step) => step.action?.type === 'final_answer',
                );

                if (isLastIteration && !hasFinalAnswer) {
                    this.logger.info(
                        '🎯 Last iteration reached, forcing final answer',
                    );
                    const finalStep = await this.forceFinalAnswer(
                        context,
                        iteration,
                        steps,
                        'Maximum iterations reached without final answer',
                    );
                    steps.push(finalStep);
                    break;
                }

                if (
                    this.shouldStop(iteration, toolCallsCount, startTime, steps)
                ) {
                    break;
                }

                const step = await this.executeIteration(
                    context,
                    iteration,
                    steps,
                );
                steps.push(step);

                this.logger.debug('✅ Iteration completed', {
                    threadId,
                    iteration,
                    actionType: step.action?.type,
                });

                if (step.action?.type === 'final_answer') {
                    this.logger.debug(
                        '🎯 Final answer reached, stopping execution',
                        {
                            iteration: iteration + 1,
                            totalSteps: steps.length,
                        },
                    );
                    break;
                }

                if (step.action?.type === 'tool_call') {
                    toolCallsCount++;
                    this.logger.debug('🔧 Tool call executed', {
                        iteration: iteration + 1,
                        toolCalls: toolCallsCount,
                        actionType: step.action.type,
                    });
                }

                iteration++;
            }

            const result = this.buildSuccessResult(
                steps,
                startTime,
                iteration,
                toolCallsCount,
            );

            this.logger.info('✅ ReAct strategy completed successfully', {
                threadId,
                success: result.success,
                steps: result.steps.length,
                executionTime: result.executionTime,
            });

            return result;
        } catch (error) {
            const result = this.buildErrorResult(
                error,
                steps,
                startTime,
                iteration,
                toolCallsCount,
            );

            this.logger.error(
                `❌ ReAct strategy completed with error: ${result.error}`,
            );

            return result;
        }
    }

    /**
     * Valida contexto de entrada com melhor robustez
     */
    private validateContext(context: StrategyExecutionContext): void {
        if (!context.input?.trim()) {
            throw new Error('Input cannot be empty');
        }

        if (!Array.isArray(context.agentContext?.availableTools)) {
            throw new Error('Tools must be an array');
        }

        if (!context.agentContext) {
            throw new Error('Agent context is required');
        }

        // Validações adicionais para melhor robustez
        if (context.input.length > 10000) {
            this.logger.warn('Input is very long, may affect performance', {
                inputLength: context.input.length,
            });
        }

        if (context.agentContext?.availableTools.length === 0) {
            this.logger.warn(
                'No tools provided - React strategy may not be able to perform complex actions',
            );
        }

        if (context.agentContext?.availableTools.length > 50) {
            this.logger.warn(
                'Many tools provided - may impact prompt size and performance',
                {
                    toolsCount: context.agentContext?.availableTools.length,
                },
            );
        }

        this.logger.debug('Context validation passed', {
            inputLength: context.input.length,
            toolsCount: context.agentContext?.availableTools?.length || 0,
            hasAgentContext: !!context.agentContext,
        });
    }

    private async executeIteration(
        context: StrategyExecutionContext,
        iteration: number,
        previousSteps: ExecutionStep[],
    ): Promise<ExecutionStep> {
        const stepStartTime = Date.now();

        try {
            const threadId = context.agentContext.thread?.id;

            const thought = await this.generateThought(
                context,
                iteration,
                previousSteps,
            );

            const actionResult = await this.executeAction(
                thought.action,
                context,
            );

            const observation = await this.analyzeResult(actionResult);

            if (threadId) {
                try {
                    await this.updateSessionMinimal(threadId, {
                        iteration: iteration + 1,
                        actionType: thought.action.type,
                        isCompleted: observation.isComplete,
                        stepId: `react-step-${iteration}`,
                        toolName:
                            thought.action.type === 'tool_call'
                                ? thought.action.toolName
                                : undefined,
                    });
                } catch (error) {
                    this.logger.debug('Session update failed (non-critical)', {
                        error,
                    });
                }
            }

            this.logger.debug('🔍 Observe step completed', {
                threadId,
                iteration,
                isComplete: observation.isComplete,
                shouldContinue: observation.shouldContinue,
            });

            const step: ExecutionStep = {
                id: `react-step-${iteration}-${Date.now()}`,
                type: 'think',
                type2: 'think' as any,
                status: 'pending',
                timestamp: stepStartTime,
                duration: Date.now() - stepStartTime,
                thought,
                action: thought.action,
                result: actionResult,
                observation,
                metadata: {
                    iteration,
                    strategy: 'react',
                    stepSequence: 'think-act-observe',
                },
            };

            return step;
        } catch (error) {
            this.logger.warn(`⚠️ Iteration ${iteration + 1} failed`, {
                error: error instanceof Error ? error.message : String(error),
            });

            // Retorna step de erro
            return {
                id: `react-step-error-${iteration}-${Date.now()}`,
                type: 'think',
                type2: 'think' as any,
                status: 'pending',
                timestamp: stepStartTime,
                duration: Date.now() - stepStartTime,
                metadata: {
                    iteration,
                    strategy: 'react',
                    error:
                        error instanceof Error ? error.message : String(error),
                },
            };
        }
    }

    private async generateThought(
        context: StrategyExecutionContext,
        iteration: number,
        previousSteps: ExecutionStep[],
    ): Promise<AgentThought> {
        if (!this.llmAdapter.call) {
            throw new Error('LLM adapter must support call method');
        }

        context.mode = 'executor';
        context.step = previousSteps[previousSteps.length - 1];
        // 🔥 MELHORADO: Histórico detalhado para o LLM entender o progresso
        context.history = previousSteps.map((step) => ({
            type: step.type || 'unknown',
            thought: step.thought
                ? {
                      reasoning: step.thought.reasoning,
                      action: step.action,
                  }
                : undefined,
            action: step.action,
            result: step.result
                ? {
                      type: step.result.type,
                      content: step.result.content,
                      success: step.result.type !== 'error',
                  }
                : undefined,
        })) as ExecutionStep[];
        const prompts = this.promptFactory.createReActPrompt(context);

        let response;
        try {
            response = await this.llmAdapter.call({
                messages: [
                    {
                        role: AgentInputEnum.SYSTEM,
                        content: prompts.systemPrompt,
                    },
                    { role: AgentInputEnum.USER, content: prompts.userPrompt },
                ],
            });
        } catch (llmError) {
            const errorMessage =
                llmError instanceof Error ? llmError.message : String(llmError);

            return {
                reasoning: `LLM encountered an error: ${errorMessage}`,
                action: {
                    type: 'final_answer',
                    content: `I encountered an error while processing your request: ${errorMessage}. Please try rephrasing your question.`,
                },
                metadata: {
                    iteration,
                    timestamp: Date.now(),
                    fallbackUsed: true,
                    errorReason: 'llm_error',
                },
            };
        }

        let content: string;
        if (typeof response.content === 'string') {
            content = response.content;
        } else if (response.content) {
            content = JSON.stringify(response.content);
        } else {
            throw new Error('LLM returned empty or invalid response');
        }

        return this.parseLLMResponse(content, iteration);
    }

    private async executeAction(
        action: AgentAction,
        context: StrategyExecutionContext,
    ): Promise<ActionResult> {
        switch (action.type) {
            case 'tool_call':
                const result = await SharedStrategyMethods.executeTool(
                    action,
                    context,
                );
                return {
                    type: 'tool_result',
                    content: result,
                    metadata: {
                        toolName: action.toolName,
                        arguments: action.input,
                        timestamp: Date.now(),
                        source: 'react-strategy',
                    },
                };

            case 'final_answer':
                return {
                    type: 'final_answer',
                    content: action.content,
                    metadata: {
                        timestamp: Date.now(),
                        source: 'react-strategy',
                    },
                };

            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    private async analyzeResult(result: ActionResult): Promise<ResultAnalysis> {
        return {
            isComplete: result.type === 'final_answer',
            isSuccessful: result.type !== 'error',
            shouldContinue: result.type === 'tool_result',
            feedback: this.generateFeedback(result),
            metadata: {
                resultType: result.type,
                timestamp: Date.now(),
            },
        };
    }

    private shouldStop(
        _iteration: number,
        toolCallsCount: number,
        startTime: number,
        steps: ExecutionStep[],
    ): boolean {
        // Timeout
        if (Date.now() - startTime > this.config.maxExecutionTime) {
            this.logger.info('🛑 Stopping: Max execution time reached');
            return true;
        }

        // Max tool calls
        if (toolCallsCount >= this.config.maxToolCalls) {
            this.logger.info('🛑 Stopping: Max tool calls reached');
            return true;
        }

        // Último step teve resposta final
        const lastStep = steps[steps.length - 1];
        if (lastStep?.action?.type === 'final_answer') {
            this.logger.info('🛑 Stopping: Final answer found');
            return true;
        }

        return false;
    }

    private extractFinalResult(steps: ExecutionStep[]): unknown {
        for (let i = steps.length - 1; i >= 0; i--) {
            const step = steps[i];

            if (step?.action?.type === 'final_answer' && step.action.content) {
                return step.action.content;
            }
            if (step?.result?.type === 'final_answer' && step.result.content) {
                return step.result.content;
            }
        }

        for (let i = steps.length - 1; i >= 0; i--) {
            const step = steps[i];
            if (step?.result?.type === 'tool_result' && step.result.content) {
                return step.result.content;
            }
        }

        return 'No final result found';
    }

    private parseLLMResponse(content: string, iteration: number): AgentThought {
        const parseResult = EnhancedJSONParser.parseWithValidation(
            content,
            (data: unknown): data is { reasoning: string; action: unknown } => {
                return (
                    typeof data === 'object' &&
                    data !== null &&
                    'reasoning' in data &&
                    'action' in data &&
                    typeof (data as any).reasoning === 'string' &&
                    typeof (data as any).action === 'object' &&
                    (data as any).action !== null
                );
            },
        );

        if (parseResult.success) {
            const parsed = parseResult.data;

            return {
                reasoning: parsed.reasoning,
                action: this.parseActionFromJSON(parsed.action),
                metadata: {
                    iteration,
                    timestamp: Date.now(),
                    parseMethod: 'enhanced-json',
                },
            };
        } else {
            this.logger.error(
                `Enhanced JSON parse failed - invalid response format: ${parseResult.error}`,
            );

            throw new Error(
                `Invalid JSON response from LLM: ${parseResult.error}. Expected format: {"reasoning": "...", "action": {...}}`,
            );
        }
    }

    private parseActionFromJSON(actionData: any): AgentAction {
        if (actionData.type === 'final_answer') {
            return {
                type: 'final_answer',
                content: actionData.content || 'Analysis completed',
            };
        }

        if (actionData.type === 'tool_call') {
            return {
                type: 'tool_call',
                toolName: actionData.toolName || actionData.tool_name,
                input: actionData.input || actionData.parameters || {},
            };
        }

        return {
            type: 'final_answer',
            content: 'Unable to determine action type',
        };
    }

    private async updateSessionMinimal(
        threadId: string,
        update: {
            iteration: number;
            actionType: string;
            isCompleted: boolean;
            stepId: string;
            toolName?: string; // 🆕 Track which tool was used
        },
    ): Promise<void> {
        try {
            const executionUpdate: {
                currentStep?: {
                    id: string;
                    status:
                        | 'pending'
                        | 'executing'
                        | 'completed'
                        | 'failed'
                        | 'skipped';
                };
                status?: 'in_progress' | 'success' | 'error' | 'partial';
                currentTool?: string;
                completedSteps?: string[];
            } = {
                currentStep: {
                    id: update.stepId,
                    status: update.isCompleted ? 'completed' : 'executing',
                },
            };

            if (update.actionType === 'tool_call') {
                executionUpdate.currentTool =
                    update.toolName || 'tool_executing';
            }

            if (update.isCompleted) {
                executionUpdate.status = 'success';
                executionUpdate.completedSteps = [update.stepId];
            } else {
                executionUpdate.status = 'in_progress';
            }

            await ContextService.updateExecution(threadId, executionUpdate);

            this.logger.debug('✅ Session updated (minimal)', {
                threadId,
                iteration: update.iteration,
                stepId: update.stepId,
                actionType: update.actionType,
                isCompleted: update.isCompleted,
            });
        } catch (error) {
            // Silent failure - session updates are non-critical
            this.logger.debug('Session update failed', {
                threadId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private generateFeedback(result: ActionResult): string {
        switch (result.type) {
            case 'final_answer':
                return 'Resposta final fornecida com sucesso.';
            case 'tool_result':
                return 'Ferramenta executada, continuando análise.';
            case 'error':
                return `Erro ocorrido: ${result.error}`;
            default:
                return 'Resultado processado.';
        }
    }

    private buildSuccessResult(
        steps: ExecutionStep[],
        startTime: number,
        iterations: number,
        toolCallsCount: number,
    ): ExecutionResult {
        const finalResult = this.extractFinalResult(steps);
        const executionTime = Date.now() - startTime;

        this.logger.info('🎯 ReAct execution completed successfully', {
            steps: steps.length,
            iterations,
            toolCalls: toolCallsCount,
            executionTime,
        });

        return {
            output: finalResult,
            strategy: 'react',
            complexity: steps.length,
            executionTime,
            steps,
            success: true,
            metadata: {
                iterations,
                toolCallsCount,
                finalStepType: steps[steps.length - 1]?.action?.type,
            },
        };
    }

    private buildErrorResult(
        error: unknown,
        steps: ExecutionStep[],
        startTime: number,
        iterations: number,
        toolCallsCount: number,
    ): ExecutionResult {
        const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
        const executionTime = Date.now() - startTime;

        this.logger.error(
            '❌ ReAct execution failed',
            error instanceof Error ? error : undefined,
            {
                stepsCompleted: steps.length,
                iterations,
                toolCalls: toolCallsCount,
                executionTime,
            },
        );

        return {
            output: null,
            strategy: 'react',
            complexity: steps.length,
            executionTime,
            steps,
            success: false,
            error: errorMessage,
            metadata: {
                iterations,
                toolCallsCount,
                failureReason: errorMessage,
            },
        };
    }

    async createFinalResponse(
        context: StrategyExecutionContext,
    ): Promise<string> {
        this.logger.info(
            '🌉 ReAct: Creating final response with ContextBridge',
        );

        try {
            const plannerContext = {
                input: context.input,
                history: context.history.map((step, index) => ({
                    ...step,
                    stepId: step.id,
                    executionId: `exec-${Date.now()}-${index}`,
                })) as any[],
                iterations: 1,
                maxIterations: this.config.maxIterations,
                plannerMetadata: {
                    agentName: context.agentContext.agentName,
                    correlationId:
                        context.agentContext.correlationId ||
                        'react-final-response',
                    tenantId: context.agentContext.tenantId || 'default',
                    thread: context.agentContext.thread || {
                        id: context.agentContext.sessionId || 'unknown',
                    },
                    startTime: context.metadata?.startTime || Date.now(),
                    enhancedContext: (context.agentContext as any)
                        .enhancedRuntimeContext,
                },
                agentContext: context.agentContext,
                isComplete: true,
                update: () => {},
                getCurrentSituation: () =>
                    `ReAct strategy completed for: ${context.input}`,
                getFinalResult: () => {
                    const executionResult = (context as any).originalResult;
                    let content = 'ReAct execution completed';

                    if (executionResult?.output) {
                        content = executionResult.output;
                    }

                    return {
                        success: true,
                        result: { content },
                        iterations: 1,
                        totalTime:
                            new Date().getTime() -
                            (context.metadata?.startTime || Date.now()),
                        thoughts: [],
                        metadata: {
                            ...context.metadata,
                            agentName: context.agentContext.agentName,
                            iterations: 1,
                            toolsUsed: context.metadata?.complexity || 0,
                            thinkingTime:
                                Date.now() -
                                (context.metadata?.startTime || Date.now()),
                        } as any,
                    };
                },
                getCurrentPlan: () => null,
            };

            const finalContext =
                await ContextService.buildFinalResponseContext(plannerContext);

            console.log('finalContext', finalContext);

            return (
                (await plannerContext.getFinalResult().result.content) ?? 'Kody'
            );
        } catch (error) {
            this.logger.error(
                '❌ ReAct: ContextBridge failed, using fallback response',
                error instanceof Error ? error : undefined,
                {
                    input: context.input,
                    agentName: context.agentContext.agentName,
                },
            );
            return 'Kody'; // Fallback response
        }
    }

    /**
     * 🔥 NOVO: Força resposta final quando não há mais iterações disponíveis
     */
    private async forceFinalAnswer(
        context: StrategyExecutionContext,
        iteration: number,
        previousSteps: ExecutionStep[],
        reason: string,
    ): Promise<ExecutionStep> {
        const stepStartTime = Date.now();

        try {
            const threadId = context.agentContext.thread?.id;

            // Modifica contexto para forçar final answer
            const forceFinalContext = {
                ...context,
                mode: 'final_answer_forced' as any,
                step: previousSteps[previousSteps.length - 1],
            };

            // 🔥 MELHORADO: Histórico detalhado para o LLM entender o progresso
            forceFinalContext.history = previousSteps.map((step) => ({
                type: step.type || 'unknown',
                thought: step.thought
                    ? {
                          reasoning: step.thought.reasoning,
                          action: step.action,
                      }
                    : undefined,
                action: step.action,
                result: step.result
                    ? {
                          type: step.result.type,
                          content:
                              step.result.type === 'tool_result'
                                  ? this.summarizeToolResult(step.result)
                                  : step.result.content,
                          success: step.result.type !== 'error',
                      }
                    : undefined,
            })) as ExecutionStep[];

            const prompts =
                this.promptFactory.createReActPrompt(forceFinalContext);

            // Adiciona instrução específica para resposta final
            const finalPrompt = {
                ...prompts,
                userPrompt:
                    prompts.userPrompt +
                    `\n\n🚨 CRITICAL: You MUST provide a final_answer now! ${reason}\n\nBased on the execution history above, provide a comprehensive final answer to the user's question.`,
            };

            let response;
            try {
                response = await this.llmAdapter.call({
                    messages: [
                        {
                            role: AgentInputEnum.SYSTEM,
                            content: prompts.systemPrompt,
                        },
                        {
                            role: AgentInputEnum.USER,
                            content: finalPrompt.userPrompt,
                        },
                    ],
                });
            } catch (llmError) {
                const errorMessage =
                    llmError instanceof Error
                        ? llmError.message
                        : String(llmError);

                return {
                    id: `react-step-force-final-${iteration}-${Date.now()}`,
                    type: 'think',
                    type2: 'think' as any,
                    status: 'pending',
                    timestamp: stepStartTime,
                    duration: Date.now() - stepStartTime,
                    action: {
                        type: 'final_answer',
                        content: `I encountered an error while processing your request: ${errorMessage}. Based on the previous steps, here's what I was able to accomplish.`,
                    },
                    metadata: {
                        iteration,
                        strategy: 'react',
                        forcedFinal: true,
                        errorReason: 'llm_error',
                    },
                };
            }

            let content: string;
            if (typeof response.content === 'string') {
                content = response.content;
            } else if (response.content) {
                content = JSON.stringify(response.content);
            } else {
                throw new Error('LLM returned empty or invalid response');
            }

            const parsedThought = this.parseLLMResponse(content, iteration);

            // Se ainda não for final_answer, força manualmente
            if (parsedThought.action.type !== 'final_answer') {
                this.logger.warn(
                    'LLM did not provide final_answer despite forcing, creating fallback',
                );

                const fallbackContent = this.generateFallbackAnswer(
                    previousSteps,
                    reason,
                );

                parsedThought.action = {
                    type: 'final_answer',
                    content: fallbackContent,
                };
            }

            const actionResult = await this.executeAction(
                parsedThought.action,
                context,
            );

            if (threadId) {
                try {
                    await this.updateSessionMinimal(threadId, {
                        iteration: iteration + 1,
                        actionType: 'final_answer',
                        isCompleted: true,
                        stepId: `react-step-force-final-${iteration}`,
                    });
                } catch (error) {
                    this.logger.debug('Session update failed (non-critical)', {
                        error,
                    });
                }
            }

            this.logger.info('🎯 Forced final answer completed', {
                threadId,
                iteration: iteration + 1,
                forced: true,
                reason,
            });

            return {
                id: `react-step-force-final-${iteration}-${Date.now()}`,
                type: 'think',
                type2: 'think' as any,
                status: 'pending',
                timestamp: stepStartTime,
                duration: Date.now() - stepStartTime,
                thought: parsedThought,
                action: parsedThought.action,
                result: actionResult,
                observation: await this.analyzeResult(actionResult),
                metadata: {
                    iteration,
                    strategy: 'react',
                    stepSequence: 'forced-final',
                    forcedFinal: true,
                    reason,
                },
            };
        } catch (error) {
            this.logger.error(
                '❌ Force final answer failed',
                error instanceof Error ? error : undefined,
                {
                    iteration,
                    reason,
                    errorMessage:
                        error instanceof Error ? error.message : String(error),
                },
            );

            // Fallback final answer
            return {
                id: `react-step-force-final-error-${iteration}-${Date.now()}`,
                type: 'think',
                type2: 'think' as any,
                status: 'pending',
                timestamp: stepStartTime,
                duration: Date.now() - stepStartTime,
                action: {
                    type: 'final_answer',
                    content: this.generateFallbackAnswer(previousSteps, reason),
                },
                metadata: {
                    iteration,
                    strategy: 'react',
                    stepSequence: 'forced-final-error',
                    forcedFinal: true,
                    reason,
                },
            };
        }
    }

    /**
     * Gera resposta fallback quando não conseguimos resposta adequada
     */
    private generateFallbackAnswer(
        previousSteps: ExecutionStep[],
        reason: string,
    ): string {
        const toolResults = previousSteps
            .filter((step) => step.result?.type === 'tool_result')
            .map((step) => this.summarizeToolResult(step.result!))
            .join('\n');

        if (toolResults) {
            return `Based on the executed tools:\n\n${toolResults}\n\n${reason}. Here's a summary of what was accomplished.`;
        }

        return `I was unable to complete the full analysis due to: ${reason}. Please try rephrasing your question or providing more specific details.`;
    }

    /**
     * 🔥 NOVO: Resume resultado da ferramenta para o contexto do LLM
     */
    private summarizeToolResult(result: ActionResult): string {
        if (result.type === 'tool_result' && result.content) {
            try {
                const contentStr =
                    typeof result.content === 'string'
                        ? result.content
                        : JSON.stringify(result.content);

                // Limitar tamanho para não sobrecarregar o prompt
                if (contentStr.length > 300) {
                    return `Tool executed successfully - ${contentStr.substring(0, 300)}...`;
                }

                return `Tool executed successfully - ${contentStr}`;
            } catch {
                return 'Tool executed successfully';
            }
        }

        return 'Tool executed successfully';
    }

    // private buildStandardAdditionalContext(
    //     context: StrategyExecutionContext,
    // ): Record<string, unknown> {
    //     let userContext =
    //         context.agentContext?.agentExecutionOptions?.userContext;

    //     if (typeof userContext === 'string') {
    //         try {
    //             userContext = JSON.parse(userContext);
    //         } catch (error) {
    //             this.logger.warn('Failed to parse userContext as JSON', {
    //                 error,
    //             });
    //         }
    //     }

    //     return {
    //         userContext,
    //         agentIdentity: context.agentContext?.agentIdentity,
    //         agentExecutionOptions: context.agentContext?.agentExecutionOptions,
    //         runtimeContext: (context.agentContext as any)
    //             ?.enhancedRuntimeContext,
    //     };
    // }
}
