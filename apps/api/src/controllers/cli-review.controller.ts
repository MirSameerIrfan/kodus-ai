import {
    Controller,
    Post,
    Body,
    Query,
    UseGuards,
    Inject,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import { checkPermissions } from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import {
    CliReviewRequestDto,
    TrialCliReviewRequestDto,
} from '../dtos/cli-review.dto';
import { ExecuteCliReviewUseCase } from '@libs/cli-review/application/use-cases/execute-cli-review.use-case';
import { TrialRateLimiterService } from '@libs/cli-review/infrastructure/services/trial-rate-limiter.service';

/**
 * Controller for CLI code review endpoints
 * Provides both authenticated and trial review capabilities
 */
@Controller('cli')
export class CliReviewController {
    constructor(
        private readonly executeCliReviewUseCase: ExecuteCliReviewUseCase,
        private readonly trialRateLimiter: TrialRateLimiterService,
        @Inject(REQUEST) private readonly request: UserRequest,
    ) {}

    /**
     * Authenticated CLI code review endpoint
     * Requires valid authentication and code review permissions
     */
    @Post('review')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodeReviewSettings,
        }),
    )
    async review(
        @Body() body: CliReviewRequestDto,
        @Query('teamId') teamId?: string,
    ) {
        const organizationId = this.request.user?.organization?.uuid;

        if (!organizationId) {
            throw new HttpException(
                'Organization UUID is missing in the request',
                HttpStatus.BAD_REQUEST,
            );
        }

        // If teamId not provided in query, try to get from user's first team
        let finalTeamId = teamId;
        if (!finalTeamId) {
            const teamMember = this.request.user?.teamMember?.[0];
            finalTeamId = (teamMember as any)?.team?.uuid;
        }

        if (!finalTeamId) {
            throw new HttpException(
                'Team ID is missing. Please provide teamId as query parameter or ensure user has a team assigned.',
                HttpStatus.BAD_REQUEST,
            );
        }

        return this.executeCliReviewUseCase.execute({
            organizationAndTeamData: {
                organizationId,
                teamId: finalTeamId,
            },
            input: {
                diff: body.diff,
                config: body.config,
            },
            isTrialMode: false,
        });
    }

    /**
     * Trial CLI code review endpoint (no authentication required)
     * Rate limited by device fingerprint
     */
    @Post('trial/review')
    async trialReview(@Body() body: TrialCliReviewRequestDto) {
        if (!body.fingerprint) {
            throw new HttpException(
                'Device fingerprint is required for trial reviews',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Check rate limit
        const rateLimitResult = await this.trialRateLimiter.checkRateLimit(
            body.fingerprint,
        );

        if (!rateLimitResult.allowed) {
            throw new HttpException(
                {
                    message: 'Rate limit exceeded. Please try again later.',
                    remaining: rateLimitResult.remaining,
                    resetAt: rateLimitResult.resetAt?.toISOString(),
                    limit: 2,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        // Execute review with trial defaults (no auth required)
        const result = await this.executeCliReviewUseCase.execute({
            organizationAndTeamData: {
                organizationId: 'trial',
                teamId: 'trial',
            },
            input: {
                diff: body.diff,
                config: body.config,
            },
            isTrialMode: true,
        });

        // Add rate limit info to response
        return {
            ...result,
            rateLimit: {
                remaining: rateLimitResult.remaining,
                limit: 2,
                resetAt: rateLimitResult.resetAt?.toISOString(),
            },
        };
    }
}
