import { PlatformType } from '@libs/common/enums/platform-type.enum';
import { AuthMode } from '../../enums/codeManagement/authMode.enum';

export type GitCloneParams = {
    url: string;
    provider: PlatformType;
    branch?: string;
    auth?: {
        type?: AuthMode;
        username?: string;
        token?: string;
        org?: string;
    };
    organizationId: string;
    repositoryId: string;
    repositoryName: string;
};
