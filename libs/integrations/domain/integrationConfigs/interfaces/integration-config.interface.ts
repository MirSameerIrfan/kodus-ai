import { IntegrationConfigKey } from '@libs/core/domain/enums/Integration-config-key.enum';
import { ITeam } from '@libs/organization/domain/team/interfaces/team.interface';

import { IIntegration } from '../../integrations/interfaces/integration.interface';

export interface IIntegrationConfig {
    uuid: string;
    configKey: IntegrationConfigKey;
    configValue: any;
    integration?: Partial<IIntegration>;
    team?: Partial<ITeam>;
}
