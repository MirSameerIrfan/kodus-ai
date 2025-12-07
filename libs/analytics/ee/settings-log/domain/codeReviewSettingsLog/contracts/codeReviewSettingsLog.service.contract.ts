import { ICodeReviewSettingsLogRepository } from '@libs/analytics/ee/settings-log/domain/codeReviewSettingsLog/contracts/codeReviewSettingsLog.repository.contract';
import { CodeReviewConfigLogParams } from '@libs/analytics/ee/settings-log/services/codeReviewConfigLog.handler';
import { IntegrationLogParams } from '@libs/analytics/ee/settings-log/services/integrationLog.handler';
import { KodyRuleLogParams } from '@libs/analytics/ee/settings-log/services/kodyRulesLog.handler';
import { PullRequestMessagesLogParams } from '@libs/analytics/ee/settings-log/services/pullRequestMessageLog.handler';
import {
    RepositoriesLogParams,
    RepositoryConfigRemovalParams,
    DirectoryConfigRemovalParams,
} from '@libs/analytics/ee/settings-log/services/repositoriesLog.handler';
import { UserStatusLogParams } from '@libs/analytics/ee/settings-log/services/userStatusLog.handler';

export const CODE_REVIEW_SETTINGS_LOG_SERVICE_TOKEN = Symbol(
    'CodeReviewSettingsLogService',
);

export interface ICodeReviewSettingsLogService
    extends ICodeReviewSettingsLogRepository {
    registerCodeReviewConfigLog(
        params: CodeReviewConfigLogParams,
    ): Promise<void>;
    registerKodyRulesLog(params: KodyRuleLogParams): Promise<void>;
    registerRepositoriesLog(params: RepositoriesLogParams): Promise<void>;
    registerRepositoryConfigurationRemoval(
        params: RepositoryConfigRemovalParams,
    ): Promise<void>;
    registerDirectoryConfigurationRemoval(
        params: DirectoryConfigRemovalParams,
    ): Promise<void>;
    registerIntegrationLog(params: IntegrationLogParams): Promise<void>;
    registerUserStatusLog(params: UserStatusLogParams): Promise<void>;
    registerPullRequestMessagesLog(
        params: PullRequestMessagesLogParams,
    ): Promise<void>;
}
