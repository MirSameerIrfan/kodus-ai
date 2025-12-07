import { AuthMode } from '@libs/platform/domain/enums/codeManagement/authMode.enum';

export type AzureReposAuthDetail = {
    orgUrl: string;
    token: string;
    orgName: string;
    authMode: AuthMode;
};
