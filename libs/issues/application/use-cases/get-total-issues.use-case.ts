import { KODY_ISSUES_MANAGEMENT_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/KodyIssuesManagement.contract';
import {
    IIssuesService,
    ISSUES_SERVICE_TOKEN,
} from '@libs/issues/domain/contracts/issues.service.contract';
import { PERMISSIONS_SERVICE_TOKEN } from '@libs/identity/domain/permissions/contracts/permissions.service.contract';
import { GetIssuesByFiltersDto } from '@libs/common/dtos/get-issues-by-filters.dto';
import { KodyIssuesManagementService } from '@libs/issues/infrastructure/service/kodyIssuesManagement.service';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthorizationService } from '@libs/identity/infrastructure/adapters/services/permissions/authorization.service';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { UserRequest } from '@libs/core/domain/types/http/user-request.type';

@Injectable()
export class GetTotalIssuesUseCase implements IUseCase {
    constructor(
        @Inject(ISSUES_SERVICE_TOKEN)
        private readonly issuesService: IIssuesService,

        @Inject(KODY_ISSUES_MANAGEMENT_SERVICE_TOKEN)
        private readonly kodyIssuesManagementService: KodyIssuesManagementService,

        @Inject(REQUEST)
        private readonly request: UserRequest,

        private readonly authorizationService: AuthorizationService,
    ) {}

    async execute(filters: GetIssuesByFiltersDto): Promise<number> {
        const newFilters: Parameters<
            typeof this.kodyIssuesManagementService.buildFilter
        >[0] = { ...filters };

        if (!newFilters?.organizationId) {
            newFilters.organizationId = this.request.user.organization.uuid;
        }

        const assignedRepositoryIds =
            await this.authorizationService.getRepositoryScope(
                this.request.user,
                Action.Read,
                ResourceType.Issues,
            );

        if (assignedRepositoryIds !== null) {
            newFilters.repositoryIds = assignedRepositoryIds;
        }

        const filter =
            await this.kodyIssuesManagementService.buildFilter(newFilters);
        return this.issuesService.count(filter);
    }
}
