import { IntegrationCategory } from '@libs/common/enums/integration-category.enum';
import { PlatformType } from '@libs/common/enums/platform-type.enum';
import { IOrganization } from '@libs/organization/domain/organization/interfaces/organization.interface';
import { IAuthIntegration } from '../../authIntegrations/interfaces/auth-integration.interface';
import { IIntegrationConfig } from '@libs/integrations/domain/configs/interfaces/integration-config.interface';
import { ITeam } from '@libs/organization/domain/team/interfaces/team.interface';

export interface IIntegration {
    uuid: string;
    platform: PlatformType;
    integrationCategory: IntegrationCategory;
    status: boolean;
    organization?: Partial<IOrganization>;
    team?: Partial<ITeam>;
    authIntegration?: Partial<IAuthIntegration>;
    integrationConfigs?: Partial<IIntegrationConfig>[];
}
