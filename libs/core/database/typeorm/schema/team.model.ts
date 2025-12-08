import { STATUS } from '@libs/common/types/database/status.type';
import { CoreModel } from '@libs/common/infrastructure/repositories/model/typeOrm';
import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import { AuthIntegrationModel } from './authIntegration.model';
import { IntegrationModel } from './integration.model';
import { IntegrationConfigModel } from './integrationConfig.model';
import { OrganizationModel } from './organization.model';
import { ParametersModel } from './parameters.model';
import { TeamAutomationModel } from './teamAutomation.model';
import { TeamMemberModel } from './teamMember.model';

@Entity('teams')
@Index('IDX_teams_org_status', ['organization', 'status'], { concurrent: true })
@Index('IDX_teams_org_created', ['organization', 'createdAt'], {
    concurrent: true,
})
export class TeamModel extends CoreModel {
    @Column()
    name: string;

    @Column({ type: 'enum', enum: STATUS, default: STATUS.PENDING })
    status: STATUS;

    @ManyToOne(() => OrganizationModel, (organization) => organization.teams)
    @JoinColumn({ name: 'organization_id', referencedColumnName: 'uuid' })
    organization: OrganizationModel;

    @OneToMany(
        () => TeamAutomationModel,
        (teamAutomation) => teamAutomation.team,
    )
    @JoinColumn({ name: 'team_id', referencedColumnName: 'uuid' })
    teamAutomations: TeamAutomationModel[];

    @OneToMany(() => AuthIntegrationModel, (config) => config.team)
    authIntegration: AuthIntegrationModel[];

    @OneToMany(() => IntegrationModel, (config) => config.team)
    integration: IntegrationModel[];

    @OneToMany(() => IntegrationConfigModel, (config) => config.team)
    integrationConfigs: IntegrationConfigModel[];

    @OneToMany(() => ParametersModel, (config) => config.team)
    parameters: ParametersModel[];

    @OneToMany(() => TeamMemberModel, (teamMember) => teamMember.team)
    teamMember: TeamMemberModel[];
}
