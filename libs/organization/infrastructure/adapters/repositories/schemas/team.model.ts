import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
} from 'typeorm';

import { AuthIntegrationModel } from '@libs/integrations/infrastructure/adapters/repositories/schemas/authIntegration.model';
import { IntegrationModel } from '@libs/integrations/infrastructure/adapters/repositories/schemas/integration.model';
import { IntegrationConfigModel } from '@libs/integrations/infrastructure/adapters/repositories/schemas/integrationConfig.model';
import { OrganizationModel } from '@libs/organization/infrastructure/adapters/repositories/schemas/organization.model';
import { ParametersModel } from '@libs/organization/infrastructure/adapters/repositories/schemas/parameters.model';
import { TeamAutomationModel } from '@libs/automation/infrastructure/adapters/repositories/schemas/teamAutomation.model';
import { TeamMemberModel } from '@libs/organization/infrastructure/adapters/repositories/schemas/teamMember.model';

import { STATUS } from '@libs/core/infrastructure/config/types/database/status.type';
import { CoreModel } from '@libs/core/infrastructure/repositories/model/typeOrm';

@Entity('teams')
@Index('IDX_teams_org_status', ['organization', 'status'], { concurrent: true })
@Index('IDX_teams_org_created', ['organization', 'createdAt'], {
    concurrent: true,
})
@Index('IDX_teams_status', ['status'], { concurrent: true })
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
