import { OrganizationAndTeamData } from '@libs/common/types/general/organizationAndTeamData';
import { IOrganizationParametersRepository } from './organizationParameters.repository.contract';
import { OrganizationParametersKey } from '@libs/common/enums/organization-parameters-key.enum';
import { OrganizationParametersEntity } from '../entities/organizationParameters.entity';

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
