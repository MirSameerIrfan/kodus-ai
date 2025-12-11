import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Inject,
    Param,
    Post,
    Query,
    Sse,
    UseGuards,
} from '@nestjs/common';
import { ExecuteDryRunDto } from '../dtos/execute-dry-run.dto';
import { ExecuteDryRunUseCase } from '@libs/dryRun/application/use-cases/execute-dry-run.use-case';
import { SseDryRunUseCase } from '@libs/dryRun/application/use-cases/sse-dry-run.use-case';
import { GetStatusDryRunUseCase } from '@libs/dryRun/application/use-cases/get-status-dry-run.use-case';
import { GetDryRunUseCase } from '@libs/dryRun/application/use-cases/get-dry-run.use-case';
import { ListDryRunsUseCase } from '@libs/dryRun/application/use-cases/list-dry-runs.use-case';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import { REQUEST } from '@nestjs/core';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import {
    checkPermissions,
    checkRepoPermissions,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';

@Controller('dry-run')
export class DryRunController {
    constructor(
        private readonly executeDryRunUseCase: ExecuteDryRunUseCase,
        private readonly getStatusDryRunUseCase: GetStatusDryRunUseCase,
        private readonly sseDryRunUseCase: SseDryRunUseCase,
        private readonly getDryRunUseCase: GetDryRunUseCase,
        private readonly listDryRunsUseCase: ListDryRunsUseCase,

        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    @Post('execute')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkRepoPermissions({
            action: Action.Manage,
            resource: ResourceType.CodeReviewSettings,
            repo: {
                key: {
                    body: 'repositoryId',
                },
            },
        }),
    )
    execute(
        @Body()
        body: ExecuteDryRunDto,
    ) {
        if (!this.request.user?.organization?.uuid) {
            throw new BadRequestException(
                'Organization UUID is missing in the request',
            );
        }

        const correlationId = this.executeDryRunUseCase.execute({
            organizationAndTeamData: {
                organizationId: this.request.user.organization.uuid,
                teamId: body.teamId,
            },
            repositoryId: body.repositoryId,
            prNumber: body.prNumber,
        });

        return correlationId;
    }

    @Get('status/:correlationId')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Manage,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    status(
        @Param('correlationId') correlationId: string,
        @Query('teamId') teamId: string,
    ) {
        if (!this.request.user?.organization?.uuid) {
            throw new BadRequestException(
                'Organization UUID is missing in the request',
            );
        }

        return this.getStatusDryRunUseCase.execute({
            organizationAndTeamData: {
                organizationId: this.request.user.organization.uuid,
                teamId,
            },
            correlationId,
        });
    }

    @Sse('events/:correlationId')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Manage,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    events(
        @Param('correlationId') correlationId: string,
        @Query('teamId') teamId: string,
    ) {
        if (!this.request.user?.organization?.uuid) {
            throw new BadRequestException(
                'Organization UUID is missing in the request',
            );
        }

        return this.sseDryRunUseCase.execute({
            correlationId,
            organizationAndTeamData: {
                teamId,
                organizationId: this.request.user.organization.uuid,
            },
        });
    }

    @Get('')
    @UseGuards(PolicyGuard)
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Manage,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    listDryRuns(
        @Query('teamId') teamId: string,
        @Query('repositoryId') repositoryId?: string,
        @Query('directoryId') directoryId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('prNumber') prNumber?: string,
        @Query('status') status?: string,
    ) {
        if (!this.request.user?.organization?.uuid) {
            throw new BadRequestException(
                'Organization UUID is missing in the request',
            );
        }

        return this.listDryRunsUseCase.execute({
            organizationAndTeamData: {
                organizationId: this.request.user.organization.uuid,
                teamId,
            },
            filters: {
                repositoryId,
                directoryId,
                status,
                startDate,
                endDate,
                prNumber,
            },
        });
    }

    @Get(':correlationId')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Manage,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    getDryRun(
        @Param('correlationId') correlationId: string,
        @Query('teamId') teamId: string,
    ) {
        if (!this.request.user?.organization?.uuid) {
            throw new BadRequestException(
                'Organization UUID is missing in the request',
            );
        }

        return this.getDryRunUseCase.execute({
            organizationAndTeamData: {
                organizationId: this.request.user.organization.uuid,
                teamId,
            },
            correlationId,
        });
    }
}
