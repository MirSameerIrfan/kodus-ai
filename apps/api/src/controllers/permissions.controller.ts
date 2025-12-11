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

import { AssignReposUseCase } from '@libs/identity/application/use-cases/permissions/assign-repos.use-case';
import { CanAccessUseCase } from '@libs/identity/application/use-cases/permissions/can-access.use-case';
import { GetAssignedReposUseCase } from '@libs/identity/application/use-cases/permissions/get-assigned-repos.use-case';
import { GetPermissionsUseCase } from '@libs/identity/application/use-cases/permissions/get-permissions.use-case';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import { checkPermissions } from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';
import { createLogger } from '@kodus/flow';

@Controller('permissions')
export class PermissionsController {
    private readonly logger = createLogger(PermissionsController.name);

    constructor(
        @Inject(REQUEST)
        private readonly request: Request & {
            user: Partial<IUser>;
        },

        private readonly getPermissionsUseCase: GetPermissionsUseCase,
        private readonly canAccessUseCase: CanAccessUseCase,
        private readonly getAssignedReposUseCase: GetAssignedReposUseCase,
        private readonly assignReposUseCase: AssignReposUseCase,
    ) {}

    @Get()
    async getPermissions(): ReturnType<GetPermissionsUseCase['execute']> {
        const { user } = this.request;

        if (!user) {
            this.logger.warn({
                message: 'No user found in request',
                context: PermissionsController.name,
            });

            return {};
        }

        return this.getPermissionsUseCase.execute({ user });
    }

    @Get('can-access')
    async can(
        @Query('action') action: Action,
        @Query('resource') resource: ResourceType,
    ): Promise<boolean> {
        const { user } = this.request;

        if (!user) {
            this.logger.warn({
                message: 'No user found in request',
                context: PermissionsController.name,
            });

            return false;
        }

        return this.canAccessUseCase.execute({ user, action, resource });
    }

    @Get('assigned-repos')
    async getAssignedRepos(
        @Query('userId') userId?: string,
    ): Promise<string[]> {
        return this.getAssignedReposUseCase.execute({ userId });
    }

    @Post('assign-repos')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.UserSettings,
        }),
    )
    async assignRepos(
        @Body()
        body: {
            repositoryIds: string[];
            userId: string;
            teamId: string;
        },
    ) {
        return this.assignReposUseCase.execute({
            repoIds: body.repositoryIds,
            userId: body.userId,
            teamId: body.teamId,
        });
    }
}
