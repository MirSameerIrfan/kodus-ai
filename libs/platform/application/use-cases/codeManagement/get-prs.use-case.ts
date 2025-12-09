import { createLogger } from '@kodus/flow';
import { OrganizationAndTeamData } from '@libs/core/domain/types/general/organizationAndTeamData';
import { PullRequest } from '@libs/platform/domain/platformIntegrations/types/codeManagement/pullRequests.type';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { CodeManagementService } from '@libs/platform/infrastructure/adapters/services/codeManagement.service';

@Injectable()
export class GetPRsUseCase implements IUseCase {
    private readonly logger = createLogger(GetPRsUseCase.name);
    constructor(
        private readonly codeManagementService: CodeManagementService,
        @Inject(REQUEST)
        private readonly request: Request & { user },
    ) {}

    public async execute(params: {
        teamId: string;
        number?: number;
        title: string;
        url?: string;
    }) {
        try {
            const { teamId } = params;
            const organizationId = this.request.user.organization.uuid;

            const organizationAndTeamData: OrganizationAndTeamData = {
                organizationId,
                teamId,
            };

            const thirtyDaysAgo = new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000,
            );

            const today = new Date(Date.now());

            const defaultFilter = {
                startDate: thirtyDaysAgo,
                endDate: today,
                number: params.number,
                title: params.title,
                url: params.url,
            };

            const pullRequests =
                await this.codeManagementService.getPullRequests({
                    organizationAndTeamData,
                    filters: defaultFilter,
                });

            if (!pullRequests?.length) {
                return [];
            }

            const limitedPRs = this.getLimitedPrsByRepo(pullRequests);

            const filteredPRs = this.getFilteredPRs(limitedPRs);

            return filteredPRs;
        } catch (error) {
            this.logger.error({
                message: 'Error while creating or updating parameters',
                context: GetPRsUseCase.name,
                error: error,
                metadata: {
                    organizationAndTeamData: {
                        organizationId: this.request.user.organization.uuid,
                        teamId: params.teamId,
                    },
                },
            });
            return [];
        }
    }

    private getLimitedPrsByRepo(pullRequests: PullRequest[]): PullRequest[] {
        const numberOfPRsPerRepo = 20;

        const groupedPRsByRepo = pullRequests?.reduce(
            (acc, pr) => {
                if (!acc[pr.repositoryData.name]) {
                    acc[pr.repositoryData.name] = [];
                }

                acc[pr.repositoryData.name].push(pr);
                return acc;
            },
            {} as Record<string, PullRequest[]>,
        );

        const filteredPRs = [] as PullRequest[];

        Object.values(groupedPRsByRepo).forEach((repoPRs) => {
            filteredPRs.push(...repoPRs.splice(0, numberOfPRsPerRepo));
        });

        return filteredPRs;
    }

    private getFilteredPRs(pullRequests: PullRequest[]) {
        const filteredPrs = pullRequests.map((pr) => {
            const id = pr?.id ?? pr?.repositoryData.id;
            return {
                id,
                repository: pr.repositoryData,
                pull_number: pr.number,
                title: pr?.message || pr?.title,
                url: pr.prURL,
            };
        });

        return filteredPrs;
    }
}
