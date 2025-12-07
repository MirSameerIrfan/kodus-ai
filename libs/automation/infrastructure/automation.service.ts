import {
    AUTOMATION_REPOSITORY_TOKEN,
    IAutomationRepository,
} from '@libs/automation/domain/contracts/automation.repository';
import { IAutomationService } from '@libs/automation/domain/contracts/automation.service';
import { AutomationEntity } from '@libs/automation/domain/entities/automation.entity';
import { IAutomation } from '@libs/automation/domain/interfaces/automation.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AutomationService implements IAutomationService {
    constructor(
        @Inject(AUTOMATION_REPOSITORY_TOKEN)
        private readonly automationRepository: IAutomationRepository,
    ) {}

    findOne(filter: Partial<IAutomation>): Promise<AutomationEntity> {
        return this.automationRepository.findOne(filter);
    }

    create(automation: IAutomation): Promise<AutomationEntity> {
        return this.automationRepository.create(automation);
    }

    update(
        filter: Partial<IAutomation>,
        data: Partial<IAutomation>,
    ): Promise<AutomationEntity> {
        return this.automationRepository.update(filter, data);
    }

    delete(uuid: string): Promise<void> {
        return this.automationRepository.delete(uuid);
    }

    findById(uuid: string): Promise<AutomationEntity> {
        return this.automationRepository.findById(uuid);
    }
    find(filter?: Partial<IAutomation>): Promise<AutomationEntity[]> {
        return this.automationRepository.find(filter);
    }
}
