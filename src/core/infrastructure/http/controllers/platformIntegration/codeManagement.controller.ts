import { CreateIntegrationUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/create-integration.use-case';
import { CreateRepositoriesUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/create-repositories';
import { GetCodeManagementMemberListUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-code-management-members-list.use-case';
import { GetRepositoriesUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-repositories';
import { Repository } from '@/core/domain/integrationConfigs/types/codeManagement/repositories.type';
import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { GetPRsUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-prs.use-case';
import { FinishOnboardingDTO } from '../../dtos/finish-onboarding.dto';
import { FinishOnboardingUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/finish-onboarding.use-case';
import { DeleteIntegrationUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/delete-integration.use-case';
import { DeleteIntegrationAndRepositoriesUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/delete-integration-and-repositories.use-case';
import {
    CheckPolicies,
    PolicyGuard,
} from '@/core/infrastructure/adapters/services/permissions/policy.guard';
import {
    Action,
    ResourceType,
} from '@/core/domain/permissions/enums/permissions.enum';
import {
    checkPermissions,
    checkRepoPermissions,
} from '@/core/infrastructure/adapters/services/permissions/policy.handlers';
import { GetRepositoryTreeByDirectoryUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-repository-tree-by-directory.use-case';
import { GetRepositoryTreeByDirectoryDto } from '../../dtos/get-repository-tree-by-directory.dto';
import { GetPRsByRepoUseCase } from '@/core/application/use-cases/platformIntegration/codeManagement/get-prs-repo.use-case';
import { PullRequestState } from '@/shared/domain/enums/pullRequestState.enum';

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
    ) {}

    @Get('/repositories/org')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Read, ResourceType.CodeReviewSettings),
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
    @CheckPolicies(checkPermissions(Action.Create, ResourceType.GitSettings))
    public async authIntegrationToken(@Body() body: any) {
        return this.createIntegrationUseCase.execute(body);
    }

    @Post('/repositories')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions(Action.Create, ResourceType.CodeReviewSettings),
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
    @CheckPolicies(checkPermissions(Action.Read, ResourceType.UserSettings))
    public async getOrganizationMembers() {
        return this.getCodeManagementMemberListUseCase.execute();
    }

    @Get('/get-prs')
    @UseGuards(PolicyGuard)
    @CheckPolicies(checkPermissions(Action.Read, ResourceType.PullRequests))
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
    @CheckPolicies(checkPermissions(Action.Read, ResourceType.PullRequests))
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
        checkPermissions(Action.Create, ResourceType.CodeReviewSettings),
    )
    public async onboardingReviewPR(
        @Body()
        body: FinishOnboardingDTO,
    ) {
        return await this.finishOnboardingUseCase.execute(body);
    }

    @Delete('/delete-integration')
    @UseGuards(PolicyGuard)
    @CheckPolicies(checkPermissions(Action.Delete, ResourceType.GitSettings))
    public async deleteIntegration(
        @Query() query: { organizationId: string; teamId: string },
    ) {
        return await this.deleteIntegrationUseCase.execute(query);
    }

    @Delete('/delete-integration-and-repositories')
    @UseGuards(PolicyGuard)
    @CheckPolicies(checkPermissions(Action.Delete, ResourceType.GitSettings))
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
        checkRepoPermissions(Action.Read, ResourceType.CodeReviewSettings, {
            key: { query: 'repositoryId' },
        }),
    )
    public async getRepositoryTreeByDirectory(
        @Query() query: GetRepositoryTreeByDirectoryDto,
    ) {
        return await this.getRepositoryTreeByDirectoryUseCase.execute(query);
    }
}
