import { GetOrganizationNameUseCase } from './get-organization-name';
import { GetOrganizationsByDomainUseCase } from './get-organizations-domain.use-case';
import { UpdateInfoOrganizationAndPhoneUseCase } from './update-infos.use-case';

export const UseCases = [
    GetOrganizationNameUseCase,
    UpdateInfoOrganizationAndPhoneUseCase,
    GetOrganizationsByDomainUseCase,
];
