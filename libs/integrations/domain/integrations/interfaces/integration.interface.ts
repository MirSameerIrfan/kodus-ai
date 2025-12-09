import { IntegrationCategory } from '@libs/core/domain/enums/integration-category.enum';
import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { IOrganization } from '@libs/organization/domain/organization/interfaces/organization.interface';
import { IAuthIntegration } from '../../authIntegrations/interfaces/auth-integration.interface';
import { ITeam } from '@libs/organization/domain/team/interfaces/team.interface';
import { IIntegrationConfig } from '../../integrationConfigs/interfaces/integration-config.interface';

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
