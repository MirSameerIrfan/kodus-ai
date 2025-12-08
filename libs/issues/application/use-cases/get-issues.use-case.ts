import { createLogger } from '@kodus/flow';
import {
    IIssuesService,
    ISSUES_SERVICE_TOKEN,
} from '@libs/issues/domain/contracts/issues.service.contract';
import { GetIssuesByFiltersDto } from '@libs/common/dtos/get-issues-by-filters.dto';
import { IUseCase } from '@libs/common/domain/interfaces/use-case.interface';
import { Inject, Injectable } from '@nestjs/common';
import { IIssue } from '@libs/issues/domain/interfaces/issues.interface';
import { CacheService } from '@libs/common/utils/cache/cache.service';
import { REQUEST } from '@nestjs/core';
import { AuthorizationService } from '@libs/identity/infrastructure/permissions/authorization.service';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { UserRequest } from '@libs/common/types/http/user-request.type';

@Injectable()
export class GetIssuesUseCase implements IUseCase {
    private readonly logger = createLogger(GetIssuesUseCase.name);
    constructor(
        @Inject(ISSUES_SERVICE_TOKEN)
        private readonly issuesService: IIssuesService,
        @Inject(REQUEST)
        private readonly request: UserRequest,
        private readonly cacheService: CacheService,
        private readonly authorizationService: AuthorizationService,
    ) {}

    async execute(filters: GetIssuesByFiltersDto): Promise<IIssue[]> {
        try {
            if (!filters?.organizationId) {
                filters.organizationId = this.request.user.organization.uuid;
            }

            const cacheKey = `issues_${filters.organizationId}`;

            let allIssues =
                await this.cacheService.getFromCache<IIssue[]>(cacheKey);

            if (!allIssues) {
                allIssues = await this.issuesService.find(
                    filters.organizationId,
                );

                if (!allIssues || allIssues?.length === 0) {
                    return [];
                }

                for (const issue of allIssues) {
                    const prNumbers = this.selectAllPrNumbers(issue);

                    issue.prNumbers = prNumbers.map(
                        (prNumber) => prNumber.number,
                    );

                    delete issue.contributingSuggestions;
                }

                allIssues.sort(
                    (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                );

                await this.cacheService.addToCache(cacheKey, allIssues, 900000); //15 minutos
            }

            if (!allIssues || allIssues.length === 0) {
                return [];
            }

            const assignedRepositoryIds =
                await this.authorizationService.getRepositoryScope(
                    this.request.user,
                    Action.Read,
                    ResourceType.Issues,
                );

            if (assignedRepositoryIds !== null) {
                allIssues = allIssues.filter((issue) =>
                    assignedRepositoryIds.includes(issue.repository.id),
                );
            }

            return allIssues;
        } catch (error) {
            this.logger.error({
                context: GetIssuesUseCase.name,
                message: 'Error getting issues',
                error,
                metadata: {
                    organizationId: filters.organizationId,
                    filters,
                },
            });

            return [];
        }
    }

    private selectAllPrNumbers(issue: IIssue): {
        number: string;
    }[] {
        const prNumbers = new Set<string>();

        if (issue.contributingSuggestions?.length) {
            issue.contributingSuggestions.forEach((suggestion) => {
                if (suggestion.prNumber) {
                    prNumbers.add(suggestion.prNumber.toString());
                }
            });
        }

        const orderedPrNumbers = Array.from(prNumbers).sort(
            (a, b) => parseInt(a) - parseInt(b),
        );

        return orderedPrNumbers.map((prNumber) => ({
            number: prNumber,
        }));
    }
}
