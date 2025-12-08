import { OrganizationParametersKey } from '@libs/common/enums/organization-parameters-key.enum';
import { IOrganization } from '@libs/organization/domain/organization/interfaces/organization.interface';

export interface IOrganizationParameters {
    uuid: string;
    configKey: OrganizationParametersKey;
    configValue: any;
    organization?: Partial<IOrganization>;
}
