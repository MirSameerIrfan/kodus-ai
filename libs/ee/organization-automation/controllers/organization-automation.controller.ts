import {
    BadRequestException,
    Body,
    Controller,
    Inject,
    Post,
    UseGuards,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import { checkPermissions } from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import { SyncIgnoredBotsUseCase } from '../use-cases/sync-ignored-bots.use-case';

@Controller('organization-automation')
export class OrganizationAutomationController {
    constructor(
        private readonly syncIgnoredBotsUseCase: SyncIgnoredBotsUseCase,
        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    @Post('/ignore-bots')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.OrganizationSettings,
        }),
    )
    public async ignoreBots(
        @Body()
        body: {
            teamId: string;
        },
    ) {
        const organizationId = this.request?.user?.organization?.uuid;

        if (!organizationId) {
            throw new BadRequestException('Missing organizationId in request');
        }

        return await this.syncIgnoredBotsUseCase.execute({
            organizationId,
            teamId: body.teamId,
        });
    }
}
