import { ITeam } from '@libs/organization/domain/team/interfaces/team.interface';
import { IOrganization } from '@libs/organization/domain/organization/interfaces/organization.interface';
import { ITeamCliKeyRepository } from './team-cli-key.repository.contract';

export const TEAM_CLI_KEY_SERVICE_TOKEN = Symbol.for('TeamCliKeyService');

export interface ValidateKeyResult {
    team: Partial<ITeam>;
    organization: Partial<IOrganization>;
}

export interface ITeamCliKeyService extends ITeamCliKeyRepository {
    generateKey(
        teamId: string,
        name: string,
        createdByUserId: string,
    ): Promise<string>;
    validateKey(key: string): Promise<ValidateKeyResult | null>;
    revokeKey(keyId: string): Promise<void>;
}
