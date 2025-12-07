import { AuthMode } from '@libs/platform/domain/enums/codeManagement/authMode.enum';

export type GithubAuthDetail = {
    authToken: string;
    installationId?: string;
    org: string;
    authMode?: AuthMode;
    accountType?: 'organization' | 'user'; // Cache para evitar verificações repetidas
};
