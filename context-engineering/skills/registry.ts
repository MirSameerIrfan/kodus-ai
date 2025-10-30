import type { SkillDefinition, SkillId, SkillRegistry } from './interfaces.js';

export class InMemorySkillRegistry implements SkillRegistry {
    private readonly skills = new Map<SkillId, SkillDefinition>();

    register(skill: SkillDefinition): void {
        this.skills.set(skill.id, skill);
    }

    get(skillId: SkillId): SkillDefinition | undefined {
        return this.skills.get(skillId);
    }

    list(): SkillDefinition[] {
        return Array.from(this.skills.values());
    }
}
