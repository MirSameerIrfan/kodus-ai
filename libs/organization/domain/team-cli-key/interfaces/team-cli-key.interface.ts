import { ITeam } from '@libs/organization/domain/team/interfaces/team.interface';
import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';

export interface ITeamCliKey {
    uuid: string;
    name: string;
    keyHash: string;
    active: boolean;
    lastUsedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    team?: Partial<ITeam>;
    createdBy?: Partial<IUser>;
}
