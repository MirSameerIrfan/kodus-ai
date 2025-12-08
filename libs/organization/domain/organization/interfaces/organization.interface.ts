import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';
import { ITeam } from '@libs/organization/domain/team/interfaces/team.interface';

export interface IOrganization {
    uuid: string;
    name: string;
    tenantName: string;
    status: boolean;
    users?: Partial<IUser>[] | null;
    teams?: Partial<ITeam>[] | null;
}
