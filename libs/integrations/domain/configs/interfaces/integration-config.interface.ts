import { IntegrationConfigKey } from '@libs/common/enums/Integration-config-key.enum';
import { IIntegration } from '@libs/integrations/domain/interfaces/integration.interface';
import { ITeam } from '@libs/organization/domain/team/interfaces/team.interface';

export interface IIntegrationConfig {
    uuid: string;
    configKey: IntegrationConfigKey;
    configValue: any;
    integration?: Partial<IIntegration>;
    team?: Partial<ITeam>;
}
