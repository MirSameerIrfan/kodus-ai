import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import { checkPermissions } from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';
import { CheckHasIntegrationByPlatformUseCase } from '@libs/integrations/application/use-cases/check-has-connection.use-case';
import { CloneIntegrationUseCase } from '@libs/integrations/application/use-cases/clone-integration.use-case';
import { GetConnectionsUseCase } from '@libs/integrations/application/use-cases/get-connections.use-case';
import { GetOrganizationIdUseCase } from '@libs/integrations/application/use-cases/get-organization-id.use-case';
import { TeamQueryDto } from 'src/dtos/teamId-query-dto';

@Controller('integration')
export class IntegrationController {
    constructor(
        private readonly getOrganizationIdUseCase: GetOrganizationIdUseCase,
        private readonly cloneIntegrationUseCase: CloneIntegrationUseCase,
        private readonly checkHasIntegrationByPlatformUseCase: CheckHasIntegrationByPlatformUseCase,
        private readonly getConnectionsUseCase: GetConnectionsUseCase,
    ) {}

    @Post('/clone-integration')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.GitSettings,
        }),
    )
    public async cloneIntegration(
        @Body()
        body: {
            teamId: string;
            teamIdClone: string;
            integrationData: { platform: string; category: string };
        },
    ) {
        return this.cloneIntegrationUseCase.execute(body);
    }

    @Get('/check-connection-platform')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.GitSettings,
        }),
    )
    public async checkHasConnectionByPlatform(@Query() query: any) {
        return this.checkHasIntegrationByPlatformUseCase.execute(query);
    }

    @Get('/organization-id')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.GitSettings,
        }),
    )
    public async getOrganizationId() {
        return this.getOrganizationIdUseCase.execute();
    }

    @Get('/connections')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    public async getConnections(@Query() query: TeamQueryDto) {
        return this.getConnectionsUseCase.execute(query.teamId);
    }
}
