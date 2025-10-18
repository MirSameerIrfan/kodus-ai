import {
    IPullRequestsService,
    PULL_REQUESTS_SERVICE_TOKEN,
} from '@/core/domain/pullRequests/contracts/pullRequests.service.contracts';
import { IPullRequests } from '@/core/domain/pullRequests/interfaces/pullRequests.interface';
import {
    TOKEN_USAGE_SERVICE_TOKEN,
    ITokenUsageService,
} from '@/core/domain/tokenUsage/contracts/tokenUsage.service.contract';
import {
    TokenUsageQueryContract,
    UsageByPrResultContract,
    DailyUsageByPrResultContract,
    DailyUsageByDeveloperResultContract,
    UsageByDeveloperResultContract,
} from '@/core/domain/tokenUsage/types/tokenUsage.types';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class TokensByDeveloperUseCase {
    constructor(
        @Inject(TOKEN_USAGE_SERVICE_TOKEN)
        private readonly tokenUsageService: ITokenUsageService,

        @Inject(PULL_REQUESTS_SERVICE_TOKEN)
        private readonly pullRequestsService: IPullRequestsService,
    ) {}

    execute(
        query: TokenUsageQueryContract,
        daily: false,
    ): Promise<UsageByDeveloperResultContract[]>;

    execute(
        query: TokenUsageQueryContract,
        daily: true,
    ): Promise<DailyUsageByDeveloperResultContract[]>;

    async execute(
        query: TokenUsageQueryContract,
        daily: boolean,
    ): Promise<
        DailyUsageByDeveloperResultContract[] | UsageByDeveloperResultContract[]
    > {
        const usages = daily
            ? await this.tokenUsageService.getDailyUsageByPr(query)
            : await this.tokenUsageService.getUsageByPr(query);

        const pullRequestsMap = await this.getPullRequestsMap(
            usages,
            query.organizationId,
        );

        const mapped = this.mapUsagesWithDevelopers(usages, pullRequestsMap);

        if (query.developer) {
            return mapped.filter(
                (usage) => usage.developer === query.developer,
            );
        }

        if (!daily) {
            return this.groupByDeveloper(mapped);
        }

        return mapped;
    }

    private async getPullRequestsMap(
        usages: { prNumber: number }[],
        organizationId: string,
    ): Promise<Map<number, IPullRequests>> {
        const pullRequestsMap = new Map<number, IPullRequests>();

        for (const usage of usages) {
            if (!pullRequestsMap.has(usage.prNumber)) {
                const pr = await this.pullRequestsService.findOne({
                    organizationId,
                    number: usage.prNumber,
                });

                if (!pr) {
                    continue;
                }

                const prObj = pr.toObject();
                pullRequestsMap.set(usage.prNumber, prObj);
            }
        }

        return pullRequestsMap;
    }

    private mapUsagesWithDevelopers(
        usages: (UsageByPrResultContract | DailyUsageByPrResultContract)[],
        pullRequestsMap: Map<number, IPullRequests>,
    ) {
        return usages.map((usage) => {
            const pr = pullRequestsMap.get(usage.prNumber);
            const developer = pr?.user?.username || 'unknown';

            return {
                ...usage,
                developer,
            };
        });
    }

    private groupByDeveloper(
        usages: UsageByDeveloperResultContract[],
    ): UsageByDeveloperResultContract[] {
        const grouped = new Map<string, UsageByDeveloperResultContract>();

        for (const usage of usages) {
            const { developer, ...rest } = usage;

            if (!grouped.has(developer)) {
                grouped.set(developer, { developer, ...rest });
            } else {
                const existing = grouped.get(developer)!;

                existing.input += rest.input;
                existing.output += rest.output;
                existing.total += rest.total;
                existing.outputReasoning += rest.outputReasoning;

                grouped.set(developer, existing);
            }
        }

        return Array.from(grouped.values());
    }
}
