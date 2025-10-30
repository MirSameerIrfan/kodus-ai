import type {
    ContextActionDescriptor,
    ContextDomain,
    ContextResourceRef,
    MCPToolReference,
    PromptRole,
    PromptScope,
} from '../../packages/context-os-core/src/interfaces.js';

export type SkillId = string;

export interface SkillMetadata {
    title: string;
    description: string;
    version: string;
    domain: ContextDomain;
    tags?: string[];
    owner?: string;
    confidentiality?: 'public' | 'internal' | 'restricted';
}

export interface SkillInstructionBlock {
    id: string;
    role: PromptRole;
    scope: PromptScope;
    content: string;
    metadata?: Record<string, unknown>;
}

export interface SkillAction {
    description?: string;
    action: ContextActionDescriptor;
}

export interface SkillResource {
    ref: ContextResourceRef;
    attachLayer?: 'core' | 'catalog' | 'active';
}

export interface SkillDefinition {
    id: SkillId;
    metadata: SkillMetadata;
    instructions: SkillInstructionBlock[];
    requiredTools?: MCPToolReference[];
    requiredActions?: SkillAction[];
    resources?: SkillResource[];
    examples?: Array<{
        title: string;
        userInput: string;
        expectedOutput?: string;
    }>;
    telemetry?: {
        emitEvents?: boolean;
        customMetadata?: Record<string, unknown>;
    };
}

export interface SkillSet {
    version: string;
    skills: SkillDefinition[];
}

export interface SkillLoader {
    load(): Promise<SkillSet>;
}

export interface SkillRegistry {
    register(skill: SkillDefinition): void;
    get(skillId: SkillId): SkillDefinition | undefined;
    list(): SkillDefinition[];
}
