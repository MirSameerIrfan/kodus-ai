import { CoreModel } from '@libs/common/infrastructure/repositories/model/typeOrm';
import { Column, Entity } from 'typeorm';
import { GlobalParametersKey } from '@libs/common/enums/global-parameters-key.enum';

@Entity('global_parameters')
export class GlobalParametersModel extends CoreModel {
    @Column({
        type: 'enum',
        enum: GlobalParametersKey,
    })
    configKey: GlobalParametersKey;

    @Column({ type: 'jsonb' })
    configValue: any;

    @Column({ nullable: true })
    description: string;
}
