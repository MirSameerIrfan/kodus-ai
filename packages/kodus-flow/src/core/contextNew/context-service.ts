/**
 * 🎯 CONTEXT SERVICE - Senior Software Engineering Solution
 *
 * Facade/Service Layer that encapsulates ALL contextNew complexity.
 * Follows: DRY, Single Responsibility, Facade Pattern, Dependency Inversion
 *
 * PRINCIPLES:
 * - ✅ Single source of truth for context operations
 * - ✅ Clean API for all components
 * - ✅ Centralized error handling and logging
 * - ✅ Performance optimization in one place
 * - ✅ Easy testing and mocking
 */

import { createLogger } from '../../observability/logger.js';
import { EnhancedContextBuilder } from './index.js';
import { IdGenerator } from '../../utils/id-generator.js';
import type {
    AgentRuntimeContext,
    ChatMessage,
    ExecutionSnapshot,
    FinalResponseContext,
} from './types/context-types.js';
import type { PlannerExecutionContext } from '../types/allTypes.js';
// UnifiedExecutionContext now handled in agent-core

const logger = createLogger('context-service');

/**
 * 🔥 CONTEXT SERVICE - Clean API for all context operations
 */
export class ContextService {
    private constructor() {
        // Private constructor - use static methods
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 🎯 PUBLIC API - Simple, direct methods
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Initialize context session (should be called first in execution chain)
     */
    static async initializeSession(
        threadId: string,
        tenantId: string,
    ): Promise<void> {
        logger.debug({
            message: '🚀 Initializing context session',
            context: 'initializeSession',

            metadata: {
                threadId,
                tenantId,
            },
        });

        try {
            const builder = EnhancedContextBuilder.getInstance();
            await builder.initializeAgentSession(threadId, tenantId);

            logger.log({
                message: '✅ Context session initialized successfully',
                context: 'initializeSession',

                metadata: {
                    threadId,
                    tenantId,
                },
            });
        } catch (error) {
            logger.error({
                message: '❌ Failed to initialize context session',
                context: 'initializeSession',
                error: error instanceof Error ? error : undefined,

                metadata: {
                    threadId,
                    tenantId,
                },
            });
            throw new Error(
                `Context session initialization failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Get current runtime context by threadId
     */
    static async getContext(threadId: string): Promise<AgentRuntimeContext> {
        logger.debug({
            message: '📖 Getting runtime context',
            context: 'getContext',

            metadata: {
                threadId,
            },
        });

        try {
            const builder = EnhancedContextBuilder.getInstance();
            const contextBridge = builder.getContextBridge();
            const context = await contextBridge.getRuntimeContext(threadId);

            logger.debug({
                message: '✅ Runtime context retrieved',
                context: 'getContext',

                metadata: {
                    threadId,
                    sessionId: context.sessionId,
                    phase: context.state.phase,
                    messagesCount: context.messages.length,
                },
            });

            return context;
        } catch (error) {
            logger.error({
                message: '❌ Failed to get runtime context',
                context: 'getContext',
                error: error instanceof Error ? error : undefined,

                metadata: {
                    threadId,
                },
            });
            throw new Error(
                `Get context failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Update execution state (centralized, no duplications)
     */
    static async updateExecution(
        threadId: string,
        executionData: {
            planId?: string;
            status?: 'in_progress' | 'success' | 'error' | 'partial';
            completedSteps?: string[];
            failedSteps?: string[];
            currentTool?: string;
            lastError?: string;
            replanCount?: number;
            phase?:
                | 'planning'
                | 'execution'
                | 'completed'
                | 'error'
                | 'responded';
            correlationId?: string;
            stepsJournalAppend?: {
                stepId: string;
                type: string;
                toolName?: string;
                status:
                    | 'pending'
                    | 'executing'
                    | 'completed'
                    | 'failed'
                    | 'skipped';
                startedAt?: number;
                endedAt?: number;
                durationMs?: number;
                errorSubcode?: string;
            };
            currentStep?: {
                id: string;
                status:
                    | 'pending'
                    | 'executing'
                    | 'completed'
                    | 'failed'
                    | 'skipped';
                toolCall?: any;
                error?: string;
            };
        },
    ): Promise<void> {
        logger.debug({
            message: '🔄 Updating execution state',
            context: 'updateExecution',

            metadata: {
                threadId,
                status: executionData.status,
                completedSteps: executionData.completedSteps?.length,
                failedSteps: executionData.failedSteps?.length,
            },
        });

        try {
            const builder = EnhancedContextBuilder.getInstance();
            const sessionManager = builder.getSessionManager();

            await sessionManager.updateExecution(
                threadId,
                executionData as any,
            );

            logger.debug({
                message: '✅ Execution state updated successfully',
                context: 'updateExecution',

                metadata: {
                    threadId,
                    status: executionData.status,
                },
            });
        } catch (error) {
            logger.error({
                message: '❌ Failed to update execution state',
                context: 'updateExecution',
                error: error instanceof Error ? error : undefined,

                metadata: {
                    threadId,
                    executionData,
                },
            });
            // Don't throw - execution updates shouldn't break main flow
        }
    }

    /**
     * Add message to conversation (centralized)
     */
    static async addMessage(
        threadId: string,
        message: {
            role: 'user' | 'assistant' | 'system' | 'tool';
            content: string;
            toolCalls?: any[];
            toolCallId?: string;
            name?: string;
            metadata?: Record<string, unknown>;
        },
    ): Promise<string> {
        logger.debug({
            message: '💬 Adding message to conversation',
            context: 'addMessage',

            metadata: {
                threadId,
                role: message.role,
                contentLength: message.content.length,
                hasToolCalls: !!message.toolCalls?.length,
            },
        });

        // 🔍 DEBUG: Log detalhado para todas as roles
        logger.log({
            message: '🔍 CONTEXT SERVICE - Adding message details',
            context: 'addMessage',

            metadata: {
                threadId,
                role: message.role,
                roleType: typeof message.role,
                isUser: message.role === 'user',
                isAssistant: message.role === 'assistant',
                isTool: message.role === 'tool',
                isSystem: message.role === 'system',

                contentPreview:
                    message.content.substring(0, 300) +
                    (message.content.length > 300 ? '...' : ''),

                metadata: message.metadata,
            },
        });

        try {
            const builder = EnhancedContextBuilder.getInstance();
            const sessionManager = builder.getSessionManager();

            // Generate unique messageId for Progressive Persistence
            const messageId =
                (message.metadata?.messageId as string) ||
                IdGenerator.messageId();

            const chatMessage: ChatMessage = {
                ...message,
                timestamp: Date.now(),
                metadata: {
                    ...message.metadata,
                    messageId, // Ensure messageId is in metadata
                },
            } as ChatMessage;

            await sessionManager.addMessage(threadId, chatMessage);

            logger.debug({
                message: '✅ Message added successfully',
                context: 'addMessage',

                metadata: {
                    threadId,
                    role: message.role,
                    messageId,
                },
            });

            return messageId;
        } catch (error) {
            logger.error({
                message: '❌ Failed to add message',
                context: 'addMessage',
                error: error instanceof Error ? error : undefined,

                metadata: {
                    threadId,
                    messageRole: message.role,
                },
            });
            // Return generated ID even on error for consistency
            return IdGenerator.messageId();
        }
    }

    /**
     * Update state (phase, intent, iterations, pending actions)
     */
    static async updateState(
        threadId: string,
        stateUpdate: {
            phase?: 'planning' | 'execution' | 'completed' | 'error';
            lastUserIntent?: string;
            pendingActions?: string[];
            currentStep?: string;
            currentIteration?: number;
            totalIterations?: number;
        },
    ): Promise<void> {
        logger.debug({
            message: '🔄 Updating context state',
            context: 'updateState',

            metadata: {
                threadId,
                phase: stateUpdate.phase,
                currentIteration: stateUpdate.currentIteration,
                pendingActionsCount: stateUpdate.pendingActions?.length,
            },
        });

        try {
            const builder = EnhancedContextBuilder.getInstance();
            const contextBridge = builder.getContextBridge();

            // Get current context to merge with update
            const currentContext =
                await contextBridge.getRuntimeContext(threadId);

            await contextBridge.updateRuntimeContext(threadId, {
                state: {
                    ...currentContext.state,
                    ...stateUpdate,
                },
            });

            logger.debug({
                message: '✅ Context state updated successfully',
                context: 'updateState',

                metadata: {
                    threadId,
                    phase: stateUpdate.phase,
                },
            });
        } catch (error) {
            logger.error({
                message: '❌ Failed to update context state',
                context: 'updateState',
                error: error instanceof Error ? error : undefined,

                metadata: {
                    threadId,
                    stateUpdate,
                },
            });
            // Don't throw - state updates shouldn't break main flow
        }
    }

    /**
     * Update existing message (for Progressive Persistence pattern)
     */
    static async updateMessage(
        threadId: string,
        messageId: string,
        updates: {
            content?: string;
            metadata?: Record<string, unknown>;
        },
    ): Promise<void> {
        logger.debug({
            message: '🔄 Updating message',
            context: 'updateMessage',

            metadata: {
                threadId,
                messageId,
                hasContent: !!updates.content,
                hasMetadata: !!updates.metadata,
            },
        });

        try {
            const builder = EnhancedContextBuilder.getInstance();
            const sessionManager = builder.getSessionManager();

            await sessionManager.updateMessage(threadId, messageId, updates);

            logger.debug({
                message: '✅ Message updated successfully',
                context: 'updateMessage',

                metadata: {
                    threadId,
                    messageId,
                },
            });
        } catch (error) {
            logger.error({
                message: '❌ Failed to update message',
                context: 'updateMessage',
                error: error instanceof Error ? error : undefined,

                metadata: {
                    threadId,
                    messageId,
                },
            });
            // Don't throw - message updates shouldn't break main flow
        }
    }

    /**
     * Add entities to context (centralized)
     */
    static async addEntities(
        threadId: string,
        entities: Record<string, any>,
    ): Promise<void> {
        logger.debug({
            message: '🏷️ Adding entities to context',
            context: 'addEntities',

            metadata: {
                threadId,
                entityTypes: Object.keys(entities),

                totalEntities: Object.values(entities).reduce(
                    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 1),
                    0,
                ),
            },
        });

        try {
            const builder = EnhancedContextBuilder.getInstance();
            const sessionManager = builder.getSessionManager();

            await sessionManager.addEntities(threadId, entities);

            logger.debug({
                message: '✅ Entities added successfully',
                context: 'addEntities',

                metadata: {
                    threadId,
                    entityTypes: Object.keys(entities),
                },
            });
        } catch (error) {
            logger.error({
                message: '❌ Failed to add entities',
                context: 'addEntities',
                error: error instanceof Error ? error : undefined,

                metadata: {
                    threadId,
                    entityTypes: Object.keys(entities),
                },
            });
            // Don't throw - entity updates shouldn't break main flow
        }
    }

    /**
     * Save execution snapshot for recovery/audit (centralized)
     */
    static async saveSnapshot(
        threadId: string,
        snapshot: ExecutionSnapshot,
    ): Promise<void> {
        logger.debug({
            message: '📸 Saving execution snapshot',
            context: 'saveSnapshot',

            metadata: {
                threadId,
                sessionId: snapshot.sessionId,
                outcome: snapshot.outcome,
            },
        });

        try {
            const builder = EnhancedContextBuilder.getInstance();
            const sessionManager = builder.getSessionManager();

            await sessionManager.saveSnapshot(threadId, snapshot);

            logger.log({
                message: '✅ Execution snapshot saved',
                context: 'saveSnapshot',

                metadata: {
                    threadId,
                    sessionId: snapshot.sessionId,
                    outcome: snapshot.outcome,
                },
            });
        } catch (error) {
            logger.error({
                message: '❌ Failed to save execution snapshot',
                context: 'saveSnapshot',
                error: error instanceof Error ? error : undefined,

                metadata: {
                    threadId,
                    sessionId: snapshot.sessionId,
                },
            });
            // Don't throw - snapshots shouldn't break main flow
        }
    }

    /**
     * Build complete final response context (solves original createFinalResponse problem)
     */
    static async buildFinalResponseContext(
        plannerContext: PlannerExecutionContext,
    ): Promise<FinalResponseContext> {
        const threadId =
            plannerContext.agentContext?.thread?.id ||
            plannerContext.agentContext?.sessionId;

        logger.debug({
            message: '🌉 Building final response context',
            context: 'buildFinalResponseContext',

            metadata: {
                threadId,
                hasAgentContext: !!plannerContext.agentContext,
            },
        });

        if (!threadId) {
            const error = new Error(
                'Missing threadId in plannerContext.agentContext',
            );
            logger.error({
                message: '❌ Cannot build final response context',
                context: 'buildFinalResponseContext',
                error: error,

                metadata: {
                    plannerContext: {
                        hasAgentContext: !!plannerContext.agentContext,
                    },
                },
            });
            throw error;
        }

        try {
            const builder = EnhancedContextBuilder.getInstance();
            const finalContext =
                await builder.buildFinalResponseContext(plannerContext);

            logger.log({
                message: '✅ Final response context built successfully',
                context: 'buildFinalResponseContext',

                metadata: {
                    threadId,
                    messagesCount: finalContext.runtime.messages.length,

                    entitiesCount: Object.keys(finalContext.runtime.entities)
                        .length,

                    successRate: finalContext.executionSummary.successRate,
                    wasRecovered: finalContext.recovery?.wasRecovered || false,
                },
            });

            return finalContext;
        } catch (error) {
            logger.error({
                message: '❌ Failed to build final response context',
                context: 'buildFinalResponseContext',
                error: error instanceof Error ? error : undefined,

                metadata: {
                    threadId,
                    plannerContext: {
                        hasAgentContext: !!plannerContext.agentContext,
                    },
                },
            });
            throw new Error(
                `Build final response context failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 🔧 UTILITY METHODS
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Check if context service is ready
     */
    static async isReady(): Promise<boolean> {
        try {
            const builder = EnhancedContextBuilder.getInstance();
            // Try to get session manager - will throw if not initialized
            builder.getSessionManager();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get context health status
     */
    static async getHealthStatus(threadId?: string): Promise<{
        healthy: boolean;
        issues: string[];
        contextExists?: boolean;
        lastActivity?: number;
    }> {
        const issues: string[] = [];
        let contextExists = false;
        let lastActivity: number | undefined;

        try {
            const builder = EnhancedContextBuilder.getInstance();
            builder.getSessionManager(); // Test if initialized

            if (threadId) {
                const context = await this.getContext(threadId);
                contextExists = true;
                lastActivity =
                    context.messages.length > 0
                        ? Math.max(...context.messages.map((m) => m.timestamp))
                        : undefined;
            }
        } catch (error) {
            issues.push(
                `Service not ready: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return {
            healthy: issues.length === 0,
            issues,
            contextExists,
            lastActivity,
        };
    }
}

// ──────────────────────────────────────────────────────────────────────────
// 🚀 EXPORTS
// ──────────────────────────────────────────────────────────────────────────

export default ContextService;

// Named export for flexibility
export { ContextService as Context };
