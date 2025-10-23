export const GET_ADDITIONAL_INFO_HELPER_TOKEN = 'GET_ADDITIONAL_INFO_HELPER_TOKEN';

export interface IGetAdditionalInfoHelper {
    getTeamIdByOrganizationAndRepository(
        organizationId: string,
        repositoryId: string,
    ): Promise<string>;

    getDirectoryPathByOrganizationAndRepository(
        organizationId: string,
        repositoryId: string,
        directoryId: string,
    ): Promise<string>;

    getRepositoryNameByOrganizationAndRepository(
        organizationId: string,
        repositoryId: string,
    ): Promise<string>;
}

