import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
} from 'typeorm';

import { AuthModel } from './auth.model';
import { OrganizationModel } from './organization.model';
import { PermissionsModel } from './permissions.model';
import { ProfileModel } from './profile.model';
import { TeamMemberModel } from './teamMember.model';

import { STATUS } from '@/config/types/database/status.type';
import { Role } from '@/core/domain/permissions/enums/permissions.enum';
import { CoreModel } from '@/shared/infrastructure/repositories/model/typeOrm';

@Entity('users')
@Index('IDX_users_email', ['email'], { concurrent: true })
@Index('IDX_users_org_status', ['organization', 'status'], { concurrent: true })
export class UserModel extends CoreModel {
    @Column({ unique: true, nullable: false })
    email: string;

    @Column({ name: 'password', nullable: false })
    password: string;

    @Column({ type: 'enum', enum: Role, default: Role.OWNER })
    role: Role;

    @Column({ type: 'enum', enum: STATUS, default: STATUS.PENDING })
    status: STATUS;

    @OneToOne(() => ProfileModel, (profile) => profile.user)
    profile: ProfileModel[];

    @ManyToOne(() => OrganizationModel, (organization) => organization.users)
    @JoinColumn({ name: 'organization_id', referencedColumnName: 'uuid' })
    organization: OrganizationModel;

    @OneToMany(() => AuthModel, (auth) => auth.user)
    auth: AuthModel[];

    @OneToMany(() => TeamMemberModel, (teamMember) => teamMember.user)
    teamMember: TeamMemberModel[];

    @OneToOne(() => PermissionsModel, (permissions) => permissions.user)
    permissions: PermissionsModel;
}
