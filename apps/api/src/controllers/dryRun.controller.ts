import { UserRequest } from '@libs/common/types/http/user-request.type';
import { ExecuteDryRunUseCase } from '@libs/dry-run/application/use-cases/execute-dry-run.use-case';
import { GetStatusDryRunUseCase } from '@libs/dry-run/application/use-cases/get-status-dry-run.use-case';
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
import { REQUEST } from '@nestjs/core';
import { SseDryRunUseCase } from '@libs/dry-run/application/use-cases/sse-dry-run.use-case';
import { ExecuteDryRunDto } from '../dtos/execute-dry-run.dto';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/permissions/policy.guard';
import {
    checkPermissions,
    checkRepoPermissions,
} from '@libs/identity/infrastructure/permissions/policy.handlers';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { GetDryRunUseCase } from '@libs/dry-run/application/use-cases/get-dry-run.use-case';
import { ListDryRunsUseCase } from '@libs/dry-run/application/use-cases/list-dry-runs.use-case';

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
        checkRepoPermissions(Action.Manage, ResourceType.CodeReviewSettings, {
            key: {
                body: 'repositoryId',
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
        checkPermissions(Action.Manage, ResourceType.CodeReviewSettings),
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
        checkPermissions(Action.Manage, ResourceType.CodeReviewSettings),
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
        checkPermissions(Action.Manage, ResourceType.CodeReviewSettings),
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
        checkPermissions(Action.Manage, ResourceType.CodeReviewSettings),
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
