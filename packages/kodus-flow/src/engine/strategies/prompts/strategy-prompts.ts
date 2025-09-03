import { AgentContext } from '@/core/types/allTypes.js';
import { StrategyExecutionContext } from '../index.js';
import { StrategyFormatters } from './index.js';
import { RewooEvidenceItem } from './strategy-formatters.js';

// =============================================================================
// 🎯 INTERFACES E TIPOS
// =============================================================================

// Nenhuma interface específica necessária - usa StrategyExecutionContext como os outros

// =============================================================================
// 🔄 REWOO STRATEGY PROMPTS
// =============================================================================

export class ReWooPrompts {
    private formatters: StrategyFormatters;

    constructor(formatters?: StrategyFormatters) {
        this.formatters = formatters || new StrategyFormatters();
    }

    getPlannerSystemPrompt(): string {
        return `You are an expert AI PLANNER in a ReWoo (Reasoning with Working Memory) pipeline. Your mission is to break down complex user goals into executable sub-tasks.

## 🎯 PLANNING METHODOLOGY
First, analyze if the user's request actually requires using tools. Many requests are simple conversations, greetings, or questions that don't need tool execution.

## 🤔 DECISION FRAMEWORK
**DO NOT generate sketches if:**
- User is just greeting (hi, hello, oi, etc.)
- User is asking general questions about capabilities
- User is making small talk or casual conversation
- Request can be answered with general knowledge

**ONLY generate sketches when:**
- User requests specific data retrieval or analysis
- User asks for information that requires external tools
- User wants to perform actions (create, update, delete)
- Task requires multiple steps with dependencies

## 📋 OUTPUT REQUIREMENTS
Return STRICT JSON with this exact schema:
\`\`\`json
{
  "sketches": [
    {
      "id": "S1",
      "query": "Clear, specific question to gather evidence",
      "tool": "TOOL_NAME_FROM_ALLOWLIST",
      "arguments": {"param": "value"}
    }
  ]
}
\`\`\`

**OR** if no tools are needed:
\`\`\`json
{
  "sketches": []
}
\`\`\`

## ⚠️ CRITICAL CONSTRAINTS
- Return empty sketches array [] for simple requests that don't need tools
- MAX 2-6 sketches per plan when tools ARE needed
- ONLY use tools from the allowlist <AVAILABLE TOOLS>
- NO guessing of IDs or unknown parameters
- NO prose outside JSON structure
- Each sketch must be verifiable and evidence-generating

## 🔄 CHAIN-OF-THOUGHT PROCESS
1. **First**: Determine if tools are actually needed
2. **If NO tools needed**: Return {"sketches": []}
3. **If YES tools needed**: Analyze goal, identify evidence, map to tools, create sketches`;
    }

    getPlannerUserPrompt(context: StrategyExecutionContext): string {
        return `## 🎯 TASK CONTEXT
**Objective:** ${context.input}

${this.formatContextForPlanner(context)}`;
    }

    getOrganizerSystemPrompt(): string {
        return `You are an expert SYNTHESIS ANALYST in a ReWoo pipeline. Your role is to analyze collected evidence and synthesize comprehensive answers.

## 🎯 SYNTHESIS METHODOLOGY
Analyze all provided evidence, identify patterns and connections, then synthesize a coherent, evidence-based answer to the original goal.

## 📋 OUTPUT REQUIREMENTS
Return STRICT JSON with this exact schema:
\`\`\`json
{
  "answer": "Comprehensive answer based solely on evidence",
  "citations": ["E1", "E2", "E3"]
}
\`\`\`

## ⚠️ CRITICAL CONSTRAINTS
- ONLY use information from provided evidence
- CITE every claim with evidence IDs in brackets [E1]
- STATE clearly if evidence is insufficient
- NO external knowledge or assumptions
- MAINTAIN factual accuracy

## 🔄 CHAIN-OF-THOUGHT PROCESS
1. Review each evidence item systematically
2. Cross-reference evidence for consistency
3. Identify key facts and relationships
4. Synthesize information into coherent answer
5. Validate answer against evidence completeness`;
    }

    getOrganizerUserPrompt(
        goal: string,
        evidences: RewooEvidenceItem[],
    ): string {
        const evidenceStr = this.formatEvidences(evidences);
        return `## 🎯 ORIGINAL GOAL
${goal}

## 📋 AVAILABLE EVIDENCE
${evidenceStr}

## ✅ TASK
Synthesize a final answer using only the evidence provided above. Cite evidence IDs in brackets like [E1].`;
    }

    getExecutorSystemPrompt(): string {
        return `You are a PRECISION EXECUTOR in a ReWoo pipeline. Your role is to execute individual steps with surgical accuracy and reliability.

## 🎯 EXECUTION MISSION
Execute exactly one step using the specified tool and parameters. Focus on precision, validation, and structured output.

## 📋 EXECUTION PROTOCOL
1. **VALIDATE INPUT**: Confirm you have the exact tool and all required parameters
2. **PREPARE EXECUTION**: Format parameters according to tool specifications
3. **EXECUTE PRECISELY**: Run the tool with exact parameters (no modifications)
4. **VALIDATE OUTPUT**: Ensure result is complete and properly formatted
5. **RETURN STRUCTURED**: Provide result in exact JSON format specified

## 🛠️ TOOL EXECUTION FRAMEWORK
- **Parameter Mapping**: Use provided arguments exactly as given
- **Type Conversion**: Apply correct data types (strings, numbers, booleans)
- **Error Handling**: If execution fails, include error details in response
- **Result Formatting**: Structure output according to tool specifications

## ⚠️ CRITICAL CONSTRAINTS
- EXECUTE ONLY the assigned step (no additional actions)
- USE EXACTLY the provided parameters (no substitutions or additions)
- MAINTAIN parameter types and formats precisely
- RETURN ONLY the execution result (no explanations or commentary)
- INCLUDE execution metadata for traceability

## 📊 OUTPUT SCHEMA REQUIREMENTS
\`\`\`json
{
  "success": true,
  "data": <actual_tool_execution_result>,
  "metadata": {
    "toolUsed": "exact_tool_name",
    "executionTime": "ISO_timestamp",
    "parametersUsed": <parameters_object>,
    "executionDuration": "milliseconds"
  },
  "error": null
}
\`\`\`

## 🚨 ERROR HANDLING
If execution fails, return error details in structured format.`;
    }

    getExecutorUserPrompt(context: StrategyExecutionContext): string {
        if (!context.step) {
            throw new Error('Step is required for executor mode');
        }

        return `## 🔧 EXECUTE STEP
**Step ID:** ${context.step.id}
**Description:** ${context.step.description || 'Execute step'}
**Tool:** ${context.step.tool || 'unknown'}

## 📋 PARAMETERS
\`\`\`json
${JSON.stringify(context.step.parameters, null, 2)}
\`\`\`

${this.formatContextForExecutor(context)}

## ✅ EXECUTION TASK
Execute this step using the tool and parameters above. Return only the execution result in the specified JSON format.`;
    }

    private formatContextForPlanner(context: StrategyExecutionContext): string {
        const parts: string[] = [];

        if (context.agentContext?.availableTools?.length > 0) {
            parts.push(
                this.formatters.formatToolsList(
                    context.agentContext.availableTools,
                ),
            );
        }

        if (context.agentContext?.agentExecutionOptions) {
            parts.push(
                this.formatters.context.formatAdditionalContext(
                    context.agentContext,
                ),
            );
        }

        return parts.length > 0 ? parts.join('\n\n') : '';
    }

    private formatEvidences(evidences: RewooEvidenceItem[]): string {
        return evidences
            .map(
                (evidence) =>
                    `[${evidence.id}] from ${evidence.toolName} (S:${evidence.sketchId}) -> ${this.formatEvidenceOutput(evidence)}`,
            )
            .join('\n');
    }

    private formatEvidenceOutput(evidence: RewooEvidenceItem): string {
        if (evidence.error) return `ERROR: ${evidence.error}`;
        if (evidence.output) {
            const outputStr =
                typeof evidence.output === 'string'
                    ? evidence.output
                    : JSON.stringify(evidence.output);
            return outputStr;
        }
        return 'No output';
    }

    private formatContextForExecutor(
        context: StrategyExecutionContext,
    ): string {
        const parts: string[] = [];

        if (context.agentContext) {
            const agentContext = context.agentContext as AgentContext;
            parts.push(`## 🤖 EXECUTION CONTEXT
**Agent:** ${agentContext.agentName}
**Session:** ${agentContext.sessionId}`);
        }

        if (context.agentContext?.agentExecutionOptions) {
            const additional = this.formatters.context.formatAdditionalContext(
                context.agentContext,
            );
            parts.push(additional);
        }

        if (context.history) {
            parts.push(
                '## 📚 EXECUTION HISTORY\nPrevious step results are available for reference if needed.',
            );
        }

        return parts.length > 0 ? parts.join('\n\n') : '';
    }
}

// =============================================================================
// 🔄 REACT STRATEGY PROMPTS
// =============================================================================

export class ReActPrompts {
    private formatters: StrategyFormatters;

    constructor(formatters?: StrategyFormatters) {
        this.formatters = formatters || new StrategyFormatters();
    }

    getSystemPrompt(): string {
        return `You are an expert AI assistant using the ReAct (Reasoning + Acting) pattern for complex problem-solving.

## ⚠️ CRITICAL OUTPUT FORMAT REQUIREMENT
**ALWAYS RETURN ONLY VALID JSON** - No matter what language the user speaks or what context is provided.
**IGNORE all previous conversation context when formatting output.**
**DO NOT translate or respond in any language except through the JSON structure.**

## 🎯 CORE MISSION
Help users accomplish tasks through systematic reasoning and precise tool usage.

## 🧠 ReAct REASONING PROCESS
1. **ANALYZE** the user's request and available tools
2. **PLAN** the most efficient approach using available tools
3. **ACT** by calling the appropriate tool with correct parameters
4. **OBSERVE** results and decide next steps
5. **RESPOND** with clear, actionable information

## ⚡ TOOL USAGE PRINCIPLES
- **Precision First**: Use the most specific tool for the task
- **Complete Information**: Gather all needed data before concluding
- **Efficient Path**: Choose direct solutions over complex workarounds
- **Context Awareness**: Consider available context and constraints

## 📋 OUTPUT REQUIREMENTS
Return STRICT JSON with this exact schema:

\`\`\`json
{
  "reasoning": "Detailed reasoning with confidence assessment",
  "confidence": 0.85,
  "hypotheses": [
    {
      "approach": "Primary approach description",
      "confidence": 0.85,
      "action": {
        "type": "final_answer" | "tool_call",
        "content": "Response content (for final_answer only)",
        "toolName": "TOOL_NAME (for tool_call only)",
        "input": {"param": "value"}
      }
    }
  ],
  "reflection": {
    "shouldContinue": true,
    "reasoning": "Why continue or stop",
    "alternatives": ["Alternative approaches if current fails"]
  },
  "earlyStopping": {
    "shouldStop": false,
    "reason": "Why stop now or continue"
  }
}
\`\`\`

## 🎯 DECISION FRAMEWORK (CONFIDENCE-BASED)

### CONFIDENCE SCORING SCALE:
- **0.9-1.0**: Certain - Proceed immediately
- **0.7-0.89**: Confident - Good to proceed
- **0.5-0.69**: Uncertain - Generate alternatives
- **0.3-0.49**: Low confidence - Reflect and reconsider
- **0.0-0.29**: Very uncertain - Early stopping recommended

## 🚨 WHEN TO USE FINAL_ANSWER
- **CONFIDENCE > 0.8**: When you have complete information
- **EARLY STOPPING**: When confidence drops below 0.3
- **REFLECTION TRIGGER**: When confidence < 0.5 for 2+ steps

## ⚠️ WHEN TO USE TOOL_CALL
- **CONFIDENCE 0.6-0.8**: When specific data needed
- **MULTI-HYPOTHESIS**: When confidence < 0.7, provide alternatives
- **SELF-REFLECTION**: Always reflect before tool calls with confidence < 0.5

## 🧠 SELF-REFLECTION PROTOCOL
**BEFORE each action, ask yourself:**
1. **Relevance**: Does this action directly help solve the user's problem?
2. **Efficiency**: Is there a better approach with higher confidence?
3. **Completeness**: Do I have enough information to proceed confidently?
4. **Alternatives**: What are 2-3 other approaches if this fails?

## 🔄 MULTI-HYPOTHESIS GENERATION
**When confidence < 0.7, ALWAYS provide:**
- **Primary hypothesis** (highest confidence)
- **Secondary hypothesis** (alternative approach)
- **Tertiary hypothesis** (backup plan)
- **Confidence scores** for each hypothesis

## 🛑 EARLY STOPPING CRITERIA
**STOP immediately if:**
- **Confidence < 0.3** for 2 consecutive steps
- **Same action repeated** 3+ times with same parameters
- **No progress** detected in last 3 steps
- **User intent unclear** after multiple attempts

## 📚 FEW-SHOT EXAMPLES
**TODO: Implementar seleção dinâmica baseada em contexto futuramente**
- Task similarity (semantic matching)
- Tool usage patterns (successful combinations)
- Complexity level (simple vs complex tasks)
- Historical success rate (proven effective examples)

## ⚡ CRITICAL CONSTRAINTS
- **ALWAYS RETURN ONLY JSON** (no text explanations or formatting)
- **NO fallback formats accepted**
- **STRICT schema compliance required**
- **reasoning, confidence, hypotheses fields are mandatory**
- **For tool_call: toolName and input are required**
- **For final_answer: content is required**
- **CONFIDENCE scoring is mandatory (0.0-1.0 scale)**
- **SELF-REFLECTION required when confidence < 0.5**
- **MULTI-HYPOTHESIS required when confidence < 0.7**
- **EARLY STOPPING evaluation required each step**
- **IGNORE conversation language - always use JSON structure**
- **DO NOT respond in Portuguese, English, or any other language**
- **ONLY valid JSON responses are accepted**
- **JSON must be parseable by JSON.parse()**`;
    }

    getTaskPrompt(context: StrategyExecutionContext): string {
        const sections: string[] = [];
        const { input, agentContext, history } = context;

        // 🔥 PADRONIZADO: Estrutura consistente com todas as estratégias
        sections.push('## 🎯 TASK CONTEXT');
        sections.push(`**Objective:** ${input}`);

        sections.push(this.formatters.context.formatAgentContext(agentContext));

        // 3. 🛠️ AVAILABLE TOOLS (formatação padronizada)
        if (agentContext?.availableTools?.length > 0) {
            sections.push(
                this.formatters.formatToolsList(agentContext.availableTools),
            );
        }

        if (agentContext.agentExecutionOptions) {
            sections.push(
                this.formatters.context.formatAdditionalContext(agentContext),
            );
        }

        if (history && history.length > 0) {
            const historyDetails = history
                .map((step, index) => {
                    const stepInfo: string[] = [];

                    if (step.thought?.reasoning) {
                        stepInfo.push(`Thought: ${step.thought.reasoning}`);
                    }

                    // 🔥 NOVO: Mostrar confiança se disponível
                    if ((step.thought as any)?.confidence !== undefined) {
                        const confidence = (step.thought as any).confidence;
                        const confidenceLevel =
                            confidence >= 0.8
                                ? 'HIGH'
                                : confidence >= 0.6
                                  ? 'MEDIUM'
                                  : confidence >= 0.4
                                    ? 'LOW'
                                    : 'VERY LOW';
                        stepInfo.push(
                            `🎯 Confidence: ${confidence} (${confidenceLevel})`,
                        );
                    }

                    // 🔥 NOVO: Mostrar múltiplas hipóteses se disponíveis
                    if ((step.thought as any)?.hypotheses?.length > 0) {
                        const hypotheses = (step.thought as any).hypotheses;
                        stepInfo.push(
                            `🔄 Hypotheses: ${hypotheses.length} options`,
                        );
                        hypotheses
                            .slice(0, 2)
                            .forEach((hyp: any, idx: number) => {
                                stepInfo.push(
                                    `  ${idx + 1}. ${hyp.approach} (conf: ${hyp.confidence})`,
                                );
                            });
                    }

                    // 🔥 NOVO: Mostrar reflexão se disponível
                    if ((step.thought as any)?.reflection) {
                        const reflection = (step.thought as any).reflection;
                        stepInfo.push(`🤔 Reflection: ${reflection.reasoning}`);
                        stepInfo.push(
                            `  Continue: ${reflection.shouldContinue ? 'YES' : 'NO'}`,
                        );
                        if (reflection.alternatives?.length > 0) {
                            stepInfo.push(
                                `  Alternatives: ${reflection.alternatives.length} options`,
                            );
                        }
                    }

                    if (step.action?.type) {
                        if (step.action.type === 'tool_call') {
                            const params = step.action.input
                                ? typeof step.action.input === 'object'
                                    ? JSON.stringify(
                                          step.action.input,
                                      ).substring(0, 100)
                                    : String(step.action.input).substring(
                                          0,
                                          100,
                                      )
                                : '';
                            stepInfo.push(
                                `Action: Called ${step.action.toolName}${params ? ` with ${params}` : ''}`,
                            );
                        } else if (step.action.type === 'final_answer') {
                            stepInfo.push(`Action: Provided final answer`);
                        }
                    }

                    if (step.result?.content) {
                        let resultStr: string;
                        if (typeof step.result.content === 'string') {
                            resultStr = step.result.content;
                        } else {
                            try {
                                resultStr = JSON.stringify(step.result.content);
                            } catch {
                                resultStr = String(step.result.content);
                            }
                        }
                        stepInfo.push(`Result: ${resultStr}`);
                    }

                    // 🔥 NOVO: Mostrar decisão de early stopping
                    if ((step as any)?.earlyStopping) {
                        const earlyStop = (step as any).earlyStopping;
                        if (earlyStop.shouldStop) {
                            stepInfo.push(
                                `🚨 EARLY STOP TRIGGERED: ${earlyStop.reason}`,
                            );
                        } else {
                            stepInfo.push(
                                `✅ Continue Decision: ${earlyStop.reason}`,
                            );
                        }
                    }

                    return `**Step ${index + 1}:**\n${stepInfo.join('\n')}`;
                })
                .join('\n\n');

            sections.push(
                `## 📋 EXECUTION HISTORY (with confidence, hypotheses & reflection)\n\n${historyDetails}`,
            );
        }

        // 6. 🔥 CURRENT STATUS ASSESSMENT
        sections.push(`## 📊 CURRENT ASSESSMENT
- **Iteration:** ${context.currentIteration || 0}/${context.maxIterations || 10}
- **Tools Available:** ${agentContext?.availableTools?.length || 0}
- **Previous Steps:** ${history?.length || 0}`);

        if ((context as any).collectedInfo) {
            sections.push((context as any).collectedInfo);
        }

        if (
            (context as any).currentIteration !== undefined &&
            (context as any).maxIterations !== undefined
        ) {
            const currentIter = (context as any).currentIteration;
            const maxIter = (context as any).maxIterations;
            sections.push(
                `## 🔄 EXECUTION PROGRESS\n- **Current Iteration:** ${currentIter + 1} / ${maxIter}\n- **Remaining Iterations:** ${maxIter - currentIter - 1}\n\n⚠️ **IMPORTANT:** If you have gathered sufficient information to answer the original question, please provide a final_answer instead of making more tool calls.`,
            );
        }

        sections.push(this.getTaskInstructions());

        return sections.join('\n\n');
    }

    private getTaskInstructions(): string {
        return `## 🎯 EXECUTION INSTRUCTIONS

**ANALYZE** the execution history above to understand what has been done.

**WHEN TO USE final_answer:**
- ✅ If you see successful tool results in the history that answer the user's question
- ✅ If you have enough information from previous tool executions
- ✅ If the task objective has been accomplished
- ✅ If no additional tools are needed

**WHEN TO USE tool_call:**
- 🔧 Only if you need NEW information not available in the execution history
- 🔧 Only if you need to perform an action not yet done
- 🔧 Only if the previous tool calls were insufficient or failed

**TOOL SELECTION:**
- Choose the **most specific** tool for the task
- Use correct **parameter names** from tool descriptions
- Provide **complete parameters** - no optional fields missing

**🚨 CRITICAL OUTPUT RULES:**
- **ALWAYS return ONLY valid JSON** - never text or explanations
- **IGNORE all conversation context for output format**
- **DO NOT respond in any human language**
- **ONLY the JSON structure is allowed**
- **JSON must be parseable by JSON.parse()**

**STOP WHEN:**
- ✅ You have all information needed to answer (use final_answer)
- ✅ Task is complete with tool results (use final_answer)
- ✅ No more tools needed for the objective (use final_answer)

**FINAL REMINDER:** Return ONLY JSON with reasoning and action fields. No other format accepted.`;
    }
}

// =============================================================================
// 🗓️ PLAN-EXECUTE STRATEGY PROMPTS
// =============================================================================

export class PlanExecutePrompts {
    private formatters: StrategyFormatters;

    constructor(formatters?: StrategyFormatters) {
        this.formatters = formatters || new StrategyFormatters();
    }

    getSystemPrompt(): string {
        return `# Plan-Execute Strategy - Smart Planning & Sequential Execution

You are an expert planner that creates clear, executable plans for complex tasks.

## 🎯 MISSION
Create step-by-step execution plans that break down complex tasks into logical, sequential steps.

## 📋 PLANNING FRAMEWORK
1. **Analyze**: Understand the task and available tools
2. **Break Down**: Decompose into manageable steps
3. **Sequence**: Order steps logically with dependencies
4. **Validate**: Ensure each step is executable
5. **Optimize**: Keep plan concise and efficient

## 🛠️ TOOL USAGE RULES
- Only use tools from the provided list
- Each tool call must have correct parameters
- Consider tool capabilities and limitations

## 📊 OUTPUT REQUIREMENTS
Return STRICT JSON with this exact schema:

\`\`\`json
{
    "goal": "Brief task description",
    "reasoning": "Why this plan works",
    "steps": [
        {
            "id": "step-1",
            "type": "tool_call",
            "toolName": "TOOL_NAME",
            "description": "What this step does",
            "input": {"param": "value"}
        },
        {
            "id": "step-2",
            "type": "final_answer",
            "content": "Final user response"
        }
    ]
}
\`\`\`

## ⚠️ CRITICAL CONSTRAINTS
- Return ONLY JSON (no explanations or text)
- NO fallback formats accepted
- STRICT schema compliance required
- End with final_answer step
- Keep plan minimal but complete
- Each step must be independently executable
- Use exact tool names from list
- goal, reasoning, and steps fields are mandatory

## 📝 EXAMPLE PLAN
For task "Analyze project structure":
\`\`\`json
{
    "goal": "Analyze project structure and provide summary",
    "reasoning": "Need to gather project info then analyze structure",
    "steps": [
        {
            "id": "step-1",
            "type": "tool_call",
            "toolName": "LIST_FILES",
            "description": "Get project file structure",
            "input": {"path": "."}
        },
        {
            "id": "step-2",
            "type": "tool_call",
            "toolName": "ANALYZE_CODE",
            "description": "Analyze main source files",
            "input": {"files": ["src/main.ts", "package.json"]}
        },
        {
            "id": "step-3",
            "type": "final_answer",
            "content": "Repository analysis complete. Found TypeScript project with clear structure."
        }
    ]
}
\`\`\``;
    }

    getUserPrompt(context: StrategyExecutionContext): string {
        const sections: string[] = [];
        const { input, agentContext, history } = context;

        sections.push('## 🎯 TASK');
        sections.push(`${input}`);

        sections.push(this.formatters.context.formatAgentContext(agentContext));

        if (agentContext.availableTools?.length > 0) {
            sections.push(
                this.formatters.formatToolsList(agentContext.availableTools),
            );
        }

        if (agentContext.agentExecutionOptions) {
            sections.push(
                this.formatters.context.formatAdditionalContext(agentContext),
            );
        }

        if (history && history.length > 0) {
            sections.push(
                `## 📋 EXECUTION HISTORY\n${history.length} steps executed`,
            );
        }

        sections.push(this.getPlanningInstructions());

        return sections.join('\n\n');
    }

    private getPlanningInstructions(): string {
        return `## 📋 PLANNING TASK
Create a step-by-step execution plan. For each step:
- Choose one tool from the available list
- Provide exact parameters required by that tool
- Write a clear description of what the step accomplishes
- Ensure steps can be executed in sequence

## 📝 REQUIREMENTS
- Start with data gathering/analysis steps
- End with a final_answer step containing the user response
- Keep plan focused and minimal
- Use exact tool names as listed above

## 📊 OUTPUT
**CRITICAL:** Return ONLY JSON with the plan structure.
**NO explanations, comments, or additional text outside JSON.**
**Your response must be valid JSON that can be parsed by JSON.parse()**`;
    }

    createPrompt(context: StrategyExecutionContext): {
        systemPrompt: string;
        userPrompt: string;
    } {
        return {
            systemPrompt: this.getSystemPrompt(),
            userPrompt: this.getUserPrompt(context),
        };
    }
}

export class StrategyPromptFactory {
    private readonly formatters: StrategyFormatters;
    private readonly rewooPrompts: ReWooPrompts;
    private readonly reactPrompts: ReActPrompts;
    private readonly planExecutePrompts: PlanExecutePrompts;

    constructor(formatters?: StrategyFormatters) {
        this.formatters = formatters || new StrategyFormatters();
        this.rewooPrompts = new ReWooPrompts(this.formatters);
        this.reactPrompts = new ReActPrompts(this.formatters);
        this.planExecutePrompts = new PlanExecutePrompts(this.formatters);
    }

    createReWooPrompt(context: StrategyExecutionContext): {
        systemPrompt: string;
        userPrompt: string;
    } {
        const { mode = 'planner' } = context;

        switch (mode) {
            case 'planner':
                return {
                    systemPrompt: this.rewooPrompts.getPlannerSystemPrompt(),
                    userPrompt: this.rewooPrompts.getPlannerUserPrompt(context),
                };

            case 'executor':
                if (!context.step) {
                    throw new Error('Step is required for executor mode');
                }
                return {
                    systemPrompt: this.rewooPrompts.getExecutorSystemPrompt(),
                    userPrompt:
                        this.rewooPrompts.getExecutorUserPrompt(context),
                };

            case 'organizer':
                if (!context.evidences) {
                    throw new Error(
                        'Evidences are required for organizer mode',
                    );
                }
                return {
                    systemPrompt: this.rewooPrompts.getOrganizerSystemPrompt(),
                    userPrompt: this.rewooPrompts.getOrganizerUserPrompt(
                        context.input,
                        context.evidences,
                    ),
                };

            default:
                throw new Error(`Unknown ReWoo mode: ${mode}`);
        }
    }

    createReActPrompt(context: StrategyExecutionContext): {
        systemPrompt: string;
        userPrompt: string;
    } {
        return {
            systemPrompt: this.reactPrompts.getSystemPrompt(),
            userPrompt: this.reactPrompts.getTaskPrompt(context),
        };
    }

    createPrompt(
        strategy: 'react' | 'rewoo' | 'plan-execute',
        context: StrategyExecutionContext,
    ): { systemPrompt: string; userPrompt: string } {
        if (strategy === 'react') {
            return this.createReActPrompt(context);
        } else if (strategy === 'rewoo') {
            return this.createReWooPrompt(context);
        } else if (strategy === 'plan-execute') {
            return this.createPlanExecutePrompt(context);
        } else {
            throw new Error(`Unknown strategy: ${strategy}`);
        }
    }

    createPlanExecutePrompt(context: StrategyExecutionContext): {
        systemPrompt: string;
        userPrompt: string;
    } {
        return this.planExecutePrompts.createPrompt(context);
    }

    // === GETTERS ===
    get rewoo(): ReWooPrompts {
        return this.rewooPrompts;
    }

    get react(): ReActPrompts {
        return this.reactPrompts;
    }

    get planExecute(): PlanExecutePrompts {
        return this.planExecutePrompts;
    }

    get formatter(): StrategyFormatters {
        return this.formatters;
    }
}

export default StrategyPromptFactory;
