import { IOrganizationParametersRepository } from './organizationParameters.repository.contract';
import { OrganizationParametersEntity } from '../entities/organizationParameters.entity';
import { OrganizationParametersKey } from '@libs/core/domain/enums';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';

export const ORGANIZATION_PARAMETERS_SERVICE_TOKEN = Symbol(
    'OrganizationParametersService',
);

export interface IOrganizationParametersService extends IOrganizationParametersRepository {
    createOrUpdateConfig(
        organizationParametersKey: OrganizationParametersKey,
        configValue: any,
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<OrganizationParametersEntity | boolean>;
    findByKey(
        configKey: OrganizationParametersKey,
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<OrganizationParametersEntity>;
    deleteByokConfig(
        organizationId: string,
        configType: 'main' | 'fallback',
    ): Promise<boolean>;
}
