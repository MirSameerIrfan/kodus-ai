import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

import {
    ITeamCliKeyRepository,
    TEAM_CLI_KEY_REPOSITORY_TOKEN,
} from '@libs/organization/domain/team-cli-key/contracts/team-cli-key.repository.contract';
import {
    ITeamCliKeyService,
    ValidateKeyResult,
} from '@libs/organization/domain/team-cli-key/contracts/team-cli-key.service.contract';
import { TeamCliKeyEntity } from '@libs/organization/domain/team-cli-key/entities/team-cli-key.entity';
import { ITeamCliKey } from '@libs/organization/domain/team-cli-key/interfaces/team-cli-key.interface';

@Injectable()
export class TeamCliKeyService implements ITeamCliKeyService {
    constructor(
        @Inject(TEAM_CLI_KEY_REPOSITORY_TOKEN)
        private readonly teamCliKeyRepository: ITeamCliKeyRepository,
    ) {}

    async generateKey(
        teamId: string,
        name: string,
        createdByUserId: string,
    ): Promise<string> {
        // Generate random key
        const rawKey = crypto.randomBytes(32).toString('base64url');

        // Hash the key before storing
        const keyHash = await bcrypt.hash(rawKey, 10);

        // Save to database
        await this.teamCliKeyRepository.create({
            name,
            keyHash,
            active: true,
            team: { uuid: teamId },
            createdBy: { uuid: createdByUserId },
        });

        // Return the raw key with prefix (only time it's shown)
        return `kodus_${rawKey}`;
    }

    async validateKey(key: string): Promise<ValidateKeyResult | null> {
        try {
            // Remove prefix
            const rawKey = key.replace(/^kodus_/, '');

            // Get all active keys
            const activeKeys = await this.teamCliKeyRepository.find({
                active: true,
            });

            // Try to match the key
            for (const keyRecord of activeKeys) {
                const match = await bcrypt.compare(rawKey, keyRecord.keyHash);

                if (match) {
                    // Update last used timestamp
                    await this.teamCliKeyRepository.update(
                        { uuid: keyRecord.uuid },
                        { lastUsedAt: new Date() },
                    );

                    if (!keyRecord.team || !keyRecord.team.organization) {
                        return null;
                    }

                    return {
                        team: keyRecord.team,
                        organization: keyRecord.team.organization,
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('Error validating CLI key:', error);
            return null;
        }
    }

    async revokeKey(keyId: string): Promise<void> {
        await this.teamCliKeyRepository.update({ uuid: keyId }, { active: false });
    }

    // Repository methods delegation
    find(filter?: Partial<ITeamCliKey>): Promise<TeamCliKeyEntity[]> {
        return this.teamCliKeyRepository.find(filter);
    }

    findOne(filter: Partial<ITeamCliKey>): Promise<TeamCliKeyEntity | undefined> {
        return this.teamCliKeyRepository.findOne(filter);
    }

    findById(uuid: string): Promise<TeamCliKeyEntity | undefined> {
        return this.teamCliKeyRepository.findById(uuid);
    }

    findByTeamId(teamId: string): Promise<TeamCliKeyEntity[]> {
        return this.teamCliKeyRepository.findByTeamId(teamId);
    }

    create(data: Partial<ITeamCliKey>): Promise<TeamCliKeyEntity | undefined> {
        return this.teamCliKeyRepository.create(data);
    }

    update(
        filter: Partial<ITeamCliKey>,
        data: Partial<ITeamCliKey>,
    ): Promise<TeamCliKeyEntity | undefined> {
        return this.teamCliKeyRepository.update(filter, data);
    }

    delete(uuid: string): Promise<void> {
        return this.teamCliKeyRepository.delete(uuid);
    }
}
