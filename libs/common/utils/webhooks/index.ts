import { PlatformType } from '@libs/core/domain/enums/platform-type.enum';
import { IMappedPlatform } from '@libs/platform/domain/platformIntegrations/types/webhooks/webhooks-common.type';

import { AzureReposMappedPlatform } from './azureRepos';
import { BitbucketMappedPlatform } from './bitbucket';
import { GithubMappedPlatform } from './github';
import { GitlabMappedPlatform } from './gitlab';

const platformMaps = new Map<PlatformType, IMappedPlatform>([
    [PlatformType.GITHUB, new GithubMappedPlatform()],
    [PlatformType.GITLAB, new GitlabMappedPlatform()],
    [PlatformType.BITBUCKET, new BitbucketMappedPlatform()],
    [PlatformType.AZURE_REPOS, new AzureReposMappedPlatform()],
] as Iterable<readonly [PlatformType, IMappedPlatform]>);

export const extractRepoFullName = (pullRequest: any): string => {
    return (
        pullRequest?.repository?.full_name ||
        pullRequest?.repository?.path_with_namespace ||
        pullRequest?.base?.repo?.full_name ||
        pullRequest?.target?.path_with_namespace ||
        pullRequest?.destination?.repository?.full_name ||
        null
    );
};

export const getMappedPlatform = (platformType: PlatformType) => {
    return platformMaps.get(platformType);
};
