import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { IntegrationModel } from './integration.model';
import { IntegrationConfigKey } from '@libs/core/domain/enums';
import { CoreModel } from '@libs/core/infrastructure/repositories/model/typeOrm';
import { TeamModel } from '@libs/organization/infrastructure/adapters/repositories/schemas/team.model';

@Entity('integration_configs')
export class IntegrationConfigModel extends CoreModel {
    @Column({
        type: 'enum',
        enum: IntegrationConfigKey,
    })
    configKey: IntegrationConfigKey;

    @Column({ type: 'jsonb' })
    configValue: any;

    @ManyToOne(
        () => IntegrationModel,
        (integration) => integration.integrationConfigs,
    )
    @JoinColumn({ name: 'integration_id', referencedColumnName: 'uuid' })
    integration: IntegrationModel;

    @ManyToOne(() => TeamModel, (team) => team.integrationConfigs)
    @JoinColumn({ name: 'team_id', referencedColumnName: 'uuid' })
    team: TeamModel;
}
