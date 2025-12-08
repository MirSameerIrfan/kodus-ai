import { OrganizationAndTeamData } from '@libs/common/types/general/organizationAndTeamData';
import { IParametersRepository } from './parameters.repository.contracts';
import { ParametersKey } from '@libs/common/enums/parameters-key.enum';
import { ParametersEntity } from '../entities/parameters.entity';

export const PARAMETERS_SERVICE_TOKEN = Symbol('ParametersService');

export interface IParametersService extends IParametersRepository {
    createOrUpdateConfig<K extends ParametersKey>(
        parametersKey: K,
        configValue: ParametersEntity<K>['configValue'],
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<ParametersEntity<K> | boolean>;
}
