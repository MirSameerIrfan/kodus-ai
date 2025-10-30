import { promises as fs } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

import type { SkillDefinition, SkillSet, SkillRegistry } from './interfaces.js';
import { InMemorySkillRegistry } from './registry.js';

function parseContent(filePath: string, content: string): SkillSet {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') {
        return yaml.load(content) as SkillSet;
    }
    return JSON.parse(content) as SkillSet;
}

function normalizeSkill(skill: SkillDefinition): SkillDefinition {
    return {
        ...skill,
        dependencies: skill.dependencies ?? [],
        requiredActions: skill.requiredActions ?? [],
        resources: skill.resources ?? [],
        instructions: skill.instructions ?? [],
    };
}

export async function loadSkillFile(filePath: string): Promise<SkillSet> {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = parseContent(filePath, raw);

    return {
        version: parsed.version,
        skills: parsed.skills.map(normalizeSkill),
    };
}

export interface LoadSkillsFromDirectoryOptions {
    registry?: SkillRegistry;
    filter?: (skill: SkillDefinition) => boolean;
}

export async function loadSkillsFromDirectory(
    directory: string,
    options: LoadSkillsFromDirectoryOptions = {},
): Promise<SkillRegistry> {
    const registry = options.registry ?? new InMemorySkillRegistry();

    const entries = await fs.readdir(directory);
    for (const entry of entries) {
        if (!/\.(ya?ml|json)$/i.test(entry)) {
            continue;
        }

        const filePath = path.join(directory, entry);
        const set = await loadSkillFile(filePath);
        set.skills
            .filter((skill) => (options.filter ? options.filter(skill) : true))
            .forEach((skill) => registry.register(skill));
    }

    return registry;
}
