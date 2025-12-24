import {
    ActionType,
    UserInfo,
} from '@libs/core/infrastructure/config/types/general/codeReviewSettingsLog.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';

export interface IntegrationLogParams {
    organizationAndTeamData: OrganizationAndTeamData;
    userInfo: UserInfo;
    integration: {
        platform: string;
        integrationCategory: string;
        status: boolean;
        authIntegration: any;
    };
    actionType: ActionType;
}

export interface UserStatusLogParams {
    organizationAndTeamData: OrganizationAndTeamData;
    userInfo: UserInfo;
    actionType: ActionType;
    userStatusChanges: Array<{
        gitId: string;
        gitTool: string;
        licenseStatus: 'active' | 'inactive';
        userName: string;
    }>;
}
