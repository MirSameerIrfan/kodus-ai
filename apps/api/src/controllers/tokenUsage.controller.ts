import { createLogger } from '@kodus/flow';
import {
    BadRequestException,
    Inject,
    UseInterceptors,
    Scope,
} from '@nestjs/common';
import {
    ITokenUsageService,
    TOKEN_USAGE_SERVICE_TOKEN,
} from '@libs/analytics/domain/token-usage/contracts/tokenUsage.service.contract';
import {
    TokenPricingQueryDto,
    TokenUsageQueryDto,
} from '@libs/analytics/infrastructure/http/dtos/token-usage.dto';
import { Query, Controller, Get } from '@nestjs/common';
import {
    DailyUsageResultContract,
    TokenUsageQueryContract,
    UsageSummaryContract,
    DailyUsageByPrResultContract,
    UsageByPrResultContract,
    DailyUsageByDeveloperResultContract,
    UsageByDeveloperResultContract,
    CostEstimateContract,
} from '@libs/analytics/domain/token-usage/types/tokenUsage.types';
import { TokensByDeveloperUseCase } from '@libs/analytics/application/use-cases/usage/tokens-developer.use-case';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { TokenPricingUseCase } from '@libs/analytics/application/use-cases/usage/token-pricing.use-case';
import { CostEstimateUseCase } from '@libs/analytics/application/use-cases/usage/cost-estimate.use-case';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Controller({ path: 'usage', scope: Scope.REQUEST })
export class TokenUsageController {
    private readonly logger = createLogger(TokenUsageController.name);
    constructor(
        @Inject(TOKEN_USAGE_SERVICE_TOKEN)
        private readonly tokenUsageService: ITokenUsageService,
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        },
        private readonly tokensByDeveloperUseCase: TokensByDeveloperUseCase,
        private readonly tokenPricingUseCase: TokenPricingUseCase,
        private readonly costEstimateUseCase: CostEstimateUseCase,
    ) {}

    @Get('tokens/summary')
    async getSummary(
        @Query() query: TokenUsageQueryDto,
    ): Promise<UsageSummaryContract> {
        try {
            const mapped = this.mapDtoToContract(query);
            return this.tokenUsageService.getSummary(mapped);
        } catch (error) {
            this.logger.error({
                message: 'Error fetching token usage summary',
                error,
                context: TokenUsageController.name,
                metadata: { query },
            });
            return {} as UsageSummaryContract;
        }
    }

    @Get('tokens/daily')
    async getDaily(
        @Query() query: TokenUsageQueryDto,
    ): Promise<DailyUsageResultContract[]> {
        try {
            const mapped = this.mapDtoToContract(query);
            return this.tokenUsageService.getDailyUsage(mapped);
        } catch (error) {
            this.logger.error({
                message: 'Error fetching daily token usage',
                error,
                context: TokenUsageController.name,
                metadata: { query },
            });
            return [];
        }
    }

    @Get('tokens/by-pr')
    async getUsageByPr(
        @Query() query: TokenUsageQueryDto,
    ): Promise<UsageByPrResultContract[]> {
        try {
            const mapped = this.mapDtoToContract(query);
            return await this.tokenUsageService.getUsageByPr(mapped);
        } catch (error) {
            this.logger.error({
                message: 'Error fetching token usage by PR',
                error,
                context: TokenUsageController.name,
                metadata: { query },
            });
            return [];
        }
    }

    @Get('tokens/daily-by-pr')
    async getDailyUsageByPr(
        @Query() query: TokenUsageQueryDto,
    ): Promise<DailyUsageByPrResultContract[]> {
        try {
            const mapped = this.mapDtoToContract(query);
            return await this.tokenUsageService.getDailyUsageByPr(mapped);
        } catch (error) {
            this.logger.error({
                message: 'Error fetching daily token usage by PR',
                error,
                context: TokenUsageController.name,
                metadata: { query },
            });
            return [];
        }
    }

    @Get('tokens/by-developer')
    async getUsageByDeveloper(
        @Query() query: TokenUsageQueryDto,
    ): Promise<UsageByDeveloperResultContract[]> {
        try {
            const mapped = this.mapDtoToContract(query);
            return await this.tokensByDeveloperUseCase.execute(mapped, false);
        } catch (error) {
            this.logger.error({
                message: 'Error fetching token usage by developer',
                error,
                context: TokenUsageController.name,
                metadata: { query },
            });
            return [];
        }
    }

    @Get('tokens/daily-by-developer')
    async getDailyByDeveloper(
        @Query() query: TokenUsageQueryDto,
    ): Promise<DailyUsageByDeveloperResultContract[]> {
        try {
            const mapped = this.mapDtoToContract(query);
            return await this.tokensByDeveloperUseCase.execute(mapped, true);
        } catch (error) {
            this.logger.error({
                message: 'Error fetching daily token usage by developer',
                error,
                context: TokenUsageController.name,
                metadata: { query },
            });
            return [];
        }
    }

    @Get('tokens/pricing')
    async getPricing(@Query() query: TokenPricingQueryDto) {
        return this.tokenPricingUseCase.execute(query.model, query.provider);
    }

    @Get('cost-estimate')
    async getCostEstimate(): Promise<CostEstimateContract> {
        const organizationId = this.request?.user?.organization?.uuid;

        if (!organizationId) {
            throw new BadRequestException(
                'organizationId not found in request',
            );
        }

        try {
            return await this.costEstimateUseCase.execute(organizationId);
        } catch (error) {
            this.logger.error({
                message: 'Error fetching cost estimate',
                error,
                context: TokenUsageController.name,
                metadata: { organizationId },
            });
            return {
                estimatedMonthlyCost: 0,
                costPerDeveloper: 0,
                developerCount: 0,
                tokenUsage: {
                    inputTokens: 0,
                    outputTokens: 0,
                    reasoningTokens: 0,
                    totalTokens: 0,
                },
                periodDays: 14,
                projectionDays: 30,
            };
        }
    }

    private mapDtoToContract(
        query: TokenUsageQueryDto,
    ): TokenUsageQueryContract {
        const start = new Date(query.startDate);
        const end = new Date(query.endDate);

        // Detect if the original strings include an explicit time component
        const startDateHasTime =
            query.startDate?.includes('T') || query.startDate?.includes(':');
        const endDateHasTime =
            query.endDate?.includes('T') || query.endDate?.includes(':');

        // Normalize date-only inputs to UTC day boundaries
        if (!Number.isNaN(start.getTime()) && !startDateHasTime) {
            start.setUTCHours(0, 0, 0, 0);
        }
        if (!Number.isNaN(end.getTime()) && !endDateHasTime) {
            end.setUTCHours(23, 59, 59, 999);
        }

        const normalized = query.byok.trim().toLowerCase();
        if (normalized !== 'true' && normalized !== 'false') {
            throw new BadRequestException(
                `byok must be a 'true' or 'false' string`,
            );
        }
        const byokBoolean = normalized === 'true';

        return {
            organizationId: query.organizationId,
            prNumber: query.prNumber,
            start,
            end,
            timezone: query.timezone || 'UTC',
            developer: query.developer,
            models: query.models,
            byok: byokBoolean,
        };
    }
}
