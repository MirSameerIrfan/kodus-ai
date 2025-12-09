import { AuthMode } from '@libs/platform/domain/enums/codeManagement/authMode.enum';

export type BitbucketAuthDetail = {
    username: string;
    appPassword: string;
    authMode: AuthMode;
    email?: string;
};
