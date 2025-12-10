import { STATUS } from '@libs/core/infrastructure/config/types/database/status.type';
import { IOrganization } from '@libs/organization/domain/organization/interfaces/organization.interface';
import { ITeamMember } from '@libs/organization/domain/teamMembers/interfaces/teamMembers.interface';

import { Role } from '../../permissions/enums/permissions.enum';
import { IPermissions } from '../../permissions/types/permissions.types';

export interface IUser {
    uuid: string;
    password: string;
    email: string;
    status: STATUS;
    role: Role;
    organization?: Partial<IOrganization> | null;
    teamMember?: Partial<ITeamMember>[] | null;
    permissions?: Partial<IPermissions> | null;
}
