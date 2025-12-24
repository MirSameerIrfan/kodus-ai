import {
    Body,
    Controller,
    Get,
    Inject,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { CreateOrUpdatePullRequestMessagesUseCase } from '@libs/code-review/application/use-cases/pullRequestMessages/create-or-update-pull-request-messages.use-case';
import { FindByRepositoryOrDirectoryIdPullRequestMessagesUseCase } from '@libs/code-review/application/use-cases/pullRequestMessages/find-by-repo-or-directory.use-case';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import {
    checkPermissions,
    checkRepoPermissions,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';
import { IPullRequestMessages } from '@libs/code-review/domain/pullRequestMessages/interfaces/pullRequestMessages.interface';

@Controller('pull-request-messages')
export class PullRequestMessagesController {
    constructor(
        private readonly createOrUpdatePullRequestMessagesUseCase: CreateOrUpdatePullRequestMessagesUseCase,
        private readonly findByRepositoryOrDirectoryIdPullRequestMessagesUseCase: FindByRepositoryOrDirectoryIdPullRequestMessagesUseCase,

        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    @Post('/')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    public async createOrUpdatePullRequestMessages(
        @Body() body: IPullRequestMessages,
    ) {
        return await this.createOrUpdatePullRequestMessagesUseCase.execute(
            this.request.user,
            body,
        );
    }

    @Get('/find-by-repository-or-directory')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkRepoPermissions({
            action: Action.Read,
            resource: ResourceType.CodeReviewSettings,
            repo: {
                key: {
                    query: 'repositoryId',
                },
            },
        }),
    )
    public async findByRepoOrDirectoryId(
        @Query('repositoryId') repositoryId: string,
        @Query('directoryId') directoryId?: string,
    ) {
        const organizationId = this.request?.user?.organization?.uuid;

        if (!organizationId) {
            throw new Error('Organization ID is missing from request');
        }

        return await this.findByRepositoryOrDirectoryIdPullRequestMessagesUseCase.execute(
            organizationId,
            repositoryId,
            directoryId,
        );
    }
}
