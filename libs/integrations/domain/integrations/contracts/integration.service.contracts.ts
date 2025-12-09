import { IntegrationCategory } from '@libs/core/domain/enums/integration-category.enum';
import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';

import { IIntegrationRepository } from './integration.repository.contracts';

export const INTEGRATION_SERVICE_TOKEN = Symbol('IntegrationService');

export interface IIntegrationService extends IIntegrationRepository {
    getPlatformAuthDetails<T>(
        organizationAndTeamData: OrganizationAndTeamData,
        platform: PlatformType,
    ): Promise<T>;
    getConnections(params: any): Promise<
        {
            platformName: string;
            isSetupComplete: boolean;
            category?: IntegrationCategory;
        }[]
    >;
    getPlatformIntegration(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<{
        codeManagement: string;
        projectManagement: string;
        communication: string;
    }>;
}
