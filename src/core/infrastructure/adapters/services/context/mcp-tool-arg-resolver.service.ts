import { Injectable } from '@nestjs/common';
import type {
    ContextDependency,
    ContextPack,
    LayerInputContext,
    RuntimeContextSnapshot,
} from '@context-os-core/interfaces';
import type { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';

type ResolutionStatus = 'ready' | 'missing';

export interface MCPToolArgResolution {
    status: ResolutionStatus;
    dependency: ContextDependency;
    missingArgs: string[];
    diagnostics: {
        requiredArgs?: string[];
        argsSources?: Record<string, string>;
        messages?: string[];
    };
}

interface ResolveParams {
    dependency: ContextDependency;
    organizationAndTeamData?: OrganizationAndTeamData;
    pack: ContextPack;
    input: LayerInputContext;
    runtime?: RuntimeContextSnapshot;
}

type TemplateContext = Record<string, unknown>;

@Injectable()
export class MCPToolArgResolver {
    async resolve({
        dependency,
        organizationAndTeamData,
        pack,
        input,
        runtime,
    }: ResolveParams): Promise<MCPToolArgResolution> {
        const metadata =
            (dependency.metadata as Record<string, unknown> | undefined) ?? {};

        const baseArgs = this.cloneArgs(metadata.args);
        const requiredArgs = this.extractStringArray(metadata.requiredArgs);
        const argMappings = this.extractRecord(metadata.argMappings);

        const context = this.buildTemplateContext(
            organizationAndTeamData,
            pack,
            input,
            runtime,
        );

        const argsSources: Record<string, string> = {};
        const resolvedArgs = this.applyArgMappings(
            baseArgs,
            argMappings,
            context,
            argsSources,
        );

        this.applyTemplateInterpolation(resolvedArgs, context, argsSources);

        const missingArgs = this.detectMissingArgs(resolvedArgs, requiredArgs);

        const enrichedDependency: ContextDependency = {
            ...dependency,
            metadata: {
                ...(dependency.metadata ?? {}),
                args: resolvedArgs,
                requiredArgs,
                missingArgs,
                argsSources,
            },
        };

        return {
            status: missingArgs.length ? 'missing' : 'ready',
            dependency: enrichedDependency,
            missingArgs,
            diagnostics: {
                requiredArgs,
                argsSources,
                messages: missingArgs.length
                    ? [
                          `Argumentos faltantes para ${this.describeTool(enrichedDependency)}: ${missingArgs.join(', ')}`,
                      ]
                    : [],
            },
        };
    }

    private cloneArgs(value: unknown): Record<string, unknown> {
        if (!value || typeof value !== 'object') {
            return {};
        }
        try {
            return JSON.parse(JSON.stringify(value)) as Record<
                string,
                unknown
            >;
        } catch {
            return {};
        }
    }

    private extractStringArray(value: unknown): string[] {
        if (!Array.isArray(value)) {
            return [];
        }
        return value
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0);
    }

    private extractRecord(
        value: unknown,
    ): Record<string, string> | undefined {
        if (!value || typeof value !== 'object') {
            return undefined;
        }
        const result: Record<string, string> = {};
        for (const [key, val] of Object.entries(
            value as Record<string, unknown>,
        )) {
            if (typeof key !== 'string' || !key.trim()) {
                continue;
            }
            if (typeof val !== 'string') {
                continue;
            }
            result[key.trim()] = val.trim();
        }
        return Object.keys(result).length ? result : undefined;
    }

    private buildTemplateContext(
        organizationAndTeamData: OrganizationAndTeamData | undefined,
        pack: ContextPack,
        input: LayerInputContext,
        runtime?: RuntimeContextSnapshot,
    ): TemplateContext {
        return {
            organization: organizationAndTeamData,
            pack,
            input,
            runtime,
            env: process.env,
        };
    }

    private applyArgMappings(
        args: Record<string, unknown>,
        argMappings: Record<string, string> | undefined,
        context: TemplateContext,
        sources: Record<string, string>,
    ): Record<string, unknown> {
        if (!argMappings) {
            return args;
        }

        const result = { ...args };

        for (const [argName, path] of Object.entries(argMappings)) {
            if (
                result[argName] !== undefined &&
                result[argName] !== null &&
                result[argName] !== ''
            ) {
                continue;
            }
            const value = this.lookupContextValue(path, context);
            if (value !== undefined) {
                result[argName] = value;
                sources[argName] = path;
            }
        }

        return result;
    }

    private applyTemplateInterpolation(
        args: Record<string, unknown>,
        context: TemplateContext,
        sources: Record<string, string>,
    ): void {
        for (const [key, value] of Object.entries(args)) {
            if (typeof value === 'string') {
                const { resolved, sourcePath } = this.resolveTemplate(
                    value,
                    context,
                );
                args[key] = resolved;
                if (sourcePath) {
                    sources[key] = sourcePath;
                }
            } else if (Array.isArray(value)) {
                args[key] = value.map((item) => {
                    if (typeof item === 'string') {
                        return this.resolveTemplate(item, context).resolved;
                    }
                    if (item && typeof item === 'object') {
                        return this.interpolateObject(
                            item as Record<string, unknown>,
                            context,
                            sources,
                        );
                    }
                    return item;
                });
            } else if (value && typeof value === 'object') {
                args[key] = this.interpolateObject(
                    value as Record<string, unknown>,
                    context,
                    sources,
                );
            }
        }
    }

    private interpolateObject(
        value: Record<string, unknown>,
        context: TemplateContext,
        sources: Record<string, string>,
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            if (typeof v === 'string') {
                const { resolved, sourcePath } = this.resolveTemplate(
                    v,
                    context,
                );
                result[k] = resolved;
                if (sourcePath) {
                    sources[k] = sourcePath;
                }
            } else if (Array.isArray(v)) {
                result[k] = v.map((item) => {
                    if (typeof item === 'string') {
                        return this.resolveTemplate(item, context).resolved;
                    }
                    if (item && typeof item === 'object') {
                        return this.interpolateObject(
                            item as Record<string, unknown>,
                            context,
                            sources,
                        );
                    }
                    return item;
                });
            } else if (v && typeof v === 'object') {
                result[k] = this.interpolateObject(
                    v as Record<string, unknown>,
                    context,
                    sources,
                );
            } else {
                result[k] = v;
            }
        }
        return result;
    }

    private resolveTemplate(
        rawValue: string,
        context: TemplateContext,
    ): { resolved: unknown; sourcePath?: string } {
        const templatePattern = /{{\s*([^}]+)\s*}}/g;
        let hasTemplate = false;
        let match: RegExpExecArray | null;
        let finalValue: string | unknown = rawValue;
        let sourcePath: string | undefined;

        while ((match = templatePattern.exec(rawValue)) !== null) {
            hasTemplate = true;
            const path = match[1];
            const value = this.lookupContextValue(path, context);
            if (value !== undefined) {
                finalValue =
                    typeof finalValue === 'string'
                        ? finalValue.replace(match[0], String(value))
                        : value;
                sourcePath = path;
            } else {
                finalValue = undefined;
                break;
            }
        }

        if (!hasTemplate) {
            return { resolved: rawValue };
        }

        return { resolved: finalValue, sourcePath };
    }

    private lookupContextValue(
        path: string,
        context: TemplateContext,
    ): unknown {
        if (!path) {
            return undefined;
        }

        const segments = path.split('.');
        let current: unknown = context;

        for (const segment of segments) {
            if (
                !segment ||
                !current ||
                (typeof current !== 'object' && !Array.isArray(current))
            ) {
                return undefined;
            }

            const candidate = current as Record<string, unknown>;
            current =
                candidate[segment] ??
                (Array.isArray(current) ? candidate[Number(segment)] : undefined);
        }

        return current;
    }

    private detectMissingArgs(
        args: Record<string, unknown>,
        requiredArgs: string[],
    ): string[] {
        if (!requiredArgs.length) {
            return [];
        }

        return requiredArgs.filter((arg) => {
            const value = args[arg];
            if (value === undefined || value === null) {
                return true;
            }
            if (typeof value === 'string' && value.trim().length === 0) {
                return true;
            }
            return false;
        });
    }

    private describeTool(dependency: ContextDependency): string {
        const provider = this.resolveDependencyProvider(dependency);
        const toolName = this.resolveDependencyToolName(dependency);
        return `${provider ?? 'unknown'}::${toolName ?? 'unknown'}`;
    }

    private resolveDependencyProvider(
        dependency: ContextDependency,
    ): string | undefined {
        const metadata =
            (dependency.metadata as Record<string, unknown> | undefined) ?? {};
        if (typeof metadata.provider === 'string') {
            return metadata.provider;
        }
        if (
            dependency.descriptor &&
            typeof dependency.descriptor === 'object'
        ) {
            const candidate = dependency.descriptor as Record<
                string,
                unknown
            >;
            if (typeof candidate.mcpId === 'string') {
                return candidate.mcpId;
            }
        }
        if (typeof dependency.id === 'string' && dependency.id.includes('|')) {
            const [provider] = dependency.id.split('|', 2);
            return provider;
        }
        return undefined;
    }

    private resolveDependencyToolName(
        dependency: ContextDependency,
    ): string | undefined {
        const metadata =
            (dependency.metadata as Record<string, unknown> | undefined) ?? {};
        if (typeof metadata.toolName === 'string') {
            return metadata.toolName;
        }
        if (
            dependency.descriptor &&
            typeof dependency.descriptor === 'object'
        ) {
            const candidate = dependency.descriptor as Record<
                string,
                unknown
            >;
            if (typeof candidate.toolName === 'string') {
                return candidate.toolName;
            }
        }
        if (typeof dependency.id === 'string' && dependency.id.includes('|')) {
            const [, tool] = dependency.id.split('|', 2);
            return tool;
        }
        return undefined;
    }

    private normalizeToolKey(value?: string | null): string | undefined {
        if (!value) {
            return undefined;
        }

        const normalized = value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        return normalized || undefined;
    }
}
