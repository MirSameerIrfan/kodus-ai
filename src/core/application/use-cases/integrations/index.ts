import { CheckHasIntegrationByPlatformUseCase } from './check-has-connection.use-case';
import { CloneIntegrationUseCase } from './clone-integration.use-case';
import { GetConnectionsUseCase } from './get-connections.use-case';
import { GetOrganizationIdUseCase } from './get-organization-id.use-case';
import { GetIntegrationConfigsByIntegrationCategoryUseCase } from './integrationConfig/getIntegrationConfigsByIntegrationCategory.use-case';

export const UseCases = [
    GetOrganizationIdUseCase,
    CloneIntegrationUseCase,
    CheckHasIntegrationByPlatformUseCase,
    GetConnectionsUseCase,
];

export const UseCasesIntegrationConfig = [
    GetIntegrationConfigsByIntegrationCategoryUseCase,
];
