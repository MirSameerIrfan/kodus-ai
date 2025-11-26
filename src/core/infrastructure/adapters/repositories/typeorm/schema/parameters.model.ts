import { ParametersKey } from '@/shared/domain/enums/parameters-key.enum';
import { CoreModel } from '@/shared/infrastructure/repositories/model/typeOrm';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TeamModel } from './team.model';

@Entity('parameters')
@Index('IDX_parameters_key_team_active', ['configKey', 'team', 'active'], {
    concurrent: true,
})
@Index('IDX_parameters_active_only', ['active'], {
    where: '"active" = true',
    concurrent: true,
})
@Index('IDX_parameters_config_value_gin', { synchronize: false }) // Typeorm does not support GIN indexes natively, so we set synchronize to false and create it manually in migrations
export class ParametersModel extends CoreModel {
    @Column({
        type: 'enum',
        enum: ParametersKey,
    })
    configKey: ParametersKey;

    @Column({ type: 'jsonb' })
    configValue: any;

    @ManyToOne(() => TeamModel, (team) => team.parameters)
    @JoinColumn({ name: 'team_id', referencedColumnName: 'uuid' })
    team: TeamModel;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'boolean', default: true })
    active: boolean;

    @Column({ type: 'integer', default: 1 })
    version: number;
}
