import { IOrganization } from '@libs/organization/domain/organization/interfaces/organization.interface';
import { ITeam } from '@libs/organization/domain/team/interfaces/team.interface';
import { IIntegration } from '../../integrations/interfaces/integration.interface';

export interface IAuthIntegration {
    uuid: string;
    status: boolean;
    authDetails?: any;
    organization?: Partial<IOrganization>;
    team?: Partial<ITeam>;
    integration?: Partial<IIntegration>;
}
