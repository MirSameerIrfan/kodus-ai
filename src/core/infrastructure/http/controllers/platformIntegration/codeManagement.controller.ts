import { CreateIntegrationUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/create-integration.use-case';
import { CreateRepositoriesUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/create-repositories';
import { DeleteIntegrationAndRepositoriesUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/delete-integration-and-repositories.use-case';
import { DeleteIntegrationUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/delete-integration.use-case';
import { FinishOnboardingUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/finish-onboarding.use-case';
import { GetCodeManagementMemberListUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-code-management-members-list.use-case';
import { GetPRsByRepoUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-prs-repo.use-case';
import { GetPRsUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-prs.use-case';
import { GetRepositoriesUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-repositories';
import { GetRepositoryTreeByDirectoryUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-repository-tree-by-directory.use-case';
import { GetWebhookStatusUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-webhook-status.use-case';
import { Repository } from '@/core/domain/integrationConfigs/types/codeManagement/repositories.type';
import {
    Action,
    ResourceType,
} from '@/core/domain/permissions/enums/permissions.enum';
import {
    CheckPolicies,
    PolicyGuard,
} from '@/core/infrastructure/adapters/services/permissions/policy.guard';
import {
    checkPermissions,
    checkRepoPermissions,
} from '@/core/infrastructure/adapters/services/permissions/policy.handlers';
import { PullRequestState } from '@/shared/domain/enums/pullRequestState.enum';
import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { FinishOnboardingDTO } from '../../dtos/finish-onboarding.dto';
import { GetRepositoryTreeByDirectoryDto } from '../../dtos/get-repository-tree-by-directory.dto';
import { WebhookStatusQueryDto } from '../../dtos/webhook-status-query.dto';

@Controller('code-management')
export class CodeManagementController {
    constructor(
        private readonly getCodeManagementMemberListUseCase: GetCodeManagementMemberListUseCase,
        private readonly createIntegrationUseCase: CreateIntegrationUseCase,
        private readonly createRepositoriesUseCase: CreateRepositoriesUseCase,
        private readonly getRepositoriesUseCase: GetRepositoriesUseCase,
        private readonly getPRsUseCase: GetPRsUseCase,
        private readonly finishOnboardingUseCase: FinishOnboardingUseCase,
        private readonly deleteIntegrationUseCase: DeleteIntegrationUseCase,
        private readonly deleteIntegrationAndRepositoriesUseCase: DeleteIntegrationAndRepositoriesUseCase,
        private readonly getRepositoryTreeByDirectoryUseCase: GetRepositoryTreeByDirectoryUseCase,
        private readonly getPRsByRepoUseCase: GetPRsByRepoUseCase,
        private readonly getWebhookStatusUseCase: GetWebhookStatusUseCase,
    ) {}

    @Get('/repositories/org')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    public async getRepositories(
        @Query()
        query: {
            teamId: string;
            organizationSelected: any;
            isSelected?: boolean;
        },
    ) {
        return this.getRepositoriesUseCase.execute(query);
    }

    @Post('/auth-integration')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.GitSettings,
        }),
    )
    public async authIntegrationToken(@Body() body: any) {
        return this.createIntegrationUseCase.execute(body);
    }

    @Post('/repositories')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    public async createRepositories(
        @Body()
        body: {
            repositories: Repository[];
            teamId: string;
            type?: 'replace' | 'append';
        },
    ) {
        return this.createRepositoriesUseCase.execute(body);
    }

    @Get('/organization-members')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.UserSettings,
        }),
    )
    public async getOrganizationMembers() {
        return this.getCodeManagementMemberListUseCase.execute();
    }

    @Get('/get-prs')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.PullRequests,
        }),
    )
    public async getPRs(
        @Query()
        query: {
            teamId: string;
            number?: number;
            title: string;
            url?: string;
        },
    ) {
        return await this.getPRsUseCase.execute({
            teamId: query.teamId,
            number: query.number,
            title: query.title,
            url: query.url,
        });
    }

    @Get('/get-prs-repo')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.PullRequests,
        }),
    )
    public async getPRsByRepo(
        @Query()
        query: {
            teamId: string;
            repositoryId: string;
            number?: number;
            startDate?: string;
            endDate?: string;
            author?: string;
            branch?: string;
            title?: string;
            state?: PullRequestState;
        },
    ) {
        const { teamId, repositoryId, ...filters } = query;
        return await this.getPRsByRepoUseCase.execute({
            teamId,
            repositoryId,
            filters,
        });
    }

    @Post('/finish-onboarding')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    public async onboardingReviewPR(
        @Body()
        body: FinishOnboardingDTO,
    ) {
        return await this.finishOnboardingUseCase.execute(body);
    }

    @Delete('/delete-integration')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Delete,
            resource: ResourceType.GitSettings,
        }),
    )
    public async deleteIntegration(
        @Query() query: { organizationId: string; teamId: string },
    ) {
        return await this.deleteIntegrationUseCase.execute(query);
    }

    @Delete('/delete-integration-and-repositories')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Delete,
            resource: ResourceType.GitSettings,
        }),
    )
    public async deleteIntegrationAndRepositories(
        @Query() query: { organizationId: string; teamId: string },
    ) {
        return await this.deleteIntegrationAndRepositoriesUseCase.execute(
            query,
        );
    }

    @Get('/get-repository-tree-by-directory')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkRepoPermissions({
            action: Action.Read,
            resource: ResourceType.CodeReviewSettings,
            repo: {
                key: { query: 'repositoryId' },
            },
        }),
    )
    public async getRepositoryTreeByDirectory(
        @Query() query: GetRepositoryTreeByDirectoryDto,
    ) {
        return await this.getRepositoryTreeByDirectoryUseCase.execute(query);
    }

    // NOT USED IN WEB - INTERNAL USE ONLY
    @Get('/webhook-status')
    public async getWebhookStatus(
        @Query() query: WebhookStatusQueryDto,
    ): Promise<{ active: boolean }> {
        return this.getWebhookStatusUseCase.execute({
            organizationAndTeamData: {
                organizationId: query.organizationId,
                teamId: query.teamId,
            },
            repositoryId: query.repositoryId,
        });
    }
}
