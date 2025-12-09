import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import { PinoLoggerService } from '@libs/core/infrastructure/logging/pino.service';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { AuthorizationService } from '@libs/identity/infrastructure/adapters/services/permissions/authorization.service';
import { CodeManagementService } from '@libs/platform/infrastructure/adapters/services/codeManagement.service';

export class GetRepositoriesUseCase implements IUseCase {
    constructor(
        private readonly codeManagementService: CodeManagementService,

        @Inject(REQUEST)
        private readonly request: UserRequest,
        private readonly logger: PinoLoggerService,

        private readonly authorizationService: AuthorizationService,
    ) {}

    public async execute(params: {
        teamId: string;
        organizationSelected: any;
        isSelected?: boolean;
    }) {
        try {
            const repositories =
                await this.codeManagementService.getRepositories({
                    organizationAndTeamData: {
                        organizationId: this.request.user.organization.uuid,
                        teamId: params?.teamId,
                    },
                    filters: {
                        organizationSelected: params?.organizationSelected,
                    },
                });

            const assignedRepositoryIds =
                await this.authorizationService.getRepositoryScope({
                    user: this.request.user,
                    action: Action.Read,
                    resource: ResourceType.CodeReviewSettings,
                });

            let filteredRepositories = repositories;
            if (assignedRepositoryIds !== null) {
                filteredRepositories = filteredRepositories.filter((repo) =>
                    assignedRepositoryIds.includes(repo.id),
                );
            }

            if (params.isSelected !== undefined) {
                filteredRepositories = filteredRepositories.filter(
                    (repo) => repo.selected === Boolean(params.isSelected),
                );
            }

            return filteredRepositories;
        } catch (error) {
            this.logger.error({
                message: 'Error while getting repositories',
                context: GetRepositoriesUseCase.name,
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
}
