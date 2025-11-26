import { CreateOrUpdatePullRequestMessagesUseCase } from './create-or-update-pull-request-messages.use-case';
import { DeleteByRepositoryOrDirectoryPullRequestMessagesUseCase } from './delete-by-repository-or-directory.use-case';
import { FindByRepositoryOrDirectoryIdPullRequestMessagesUseCase } from './find-by-repo-or-directory.use-case';

export const PullRequestMessagesUseCases = [
    CreateOrUpdatePullRequestMessagesUseCase,
    DeleteByRepositoryOrDirectoryPullRequestMessagesUseCase,
    FindByRepositoryOrDirectoryIdPullRequestMessagesUseCase,
];
