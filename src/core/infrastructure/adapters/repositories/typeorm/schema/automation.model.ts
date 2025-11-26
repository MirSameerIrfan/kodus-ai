import { AutomationType } from '@/core/domain/automation/enums/automation-type';
import { AutomationLevel } from '@/shared/domain/enums/automations-level.enum';
import { CoreModel } from '@/shared/infrastructure/repositories/model/typeOrm';
import { Column, Entity, JoinColumn, OneToMany } from 'typeorm';
import { TeamAutomationModel } from './teamAutomation.model';

@Entity('automation')
export class AutomationModel extends CoreModel {
    @Column()
    name: string;

    @Column()
    description: string;

    @Column('simple-array')
    tags: string[];

    @Column('simple-array')
    antiPatterns: string[];

    @Column({ type: 'boolean', default: true })
    status: boolean;

    @Column({ type: 'enum', enum: AutomationType, unique: true })
    automationType: AutomationType;

    @Column({
        type: 'enum',
        enum: AutomationLevel,
        default: AutomationLevel.TEAM,
    })
    level: AutomationLevel;

    @OneToMany(
        () => TeamAutomationModel,
        (teamAutomation) => teamAutomation.automation,
    )
    @JoinColumn({ name: 'team_automation_id', referencedColumnName: 'uuid' })
    teamAutomations: TeamAutomationModel[];
}
