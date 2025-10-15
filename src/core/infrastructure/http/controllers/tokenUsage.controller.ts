import { Inject } from '@nestjs/common';
import {
    ITokenUsageService,
    TOKEN_USAGE_SERVICE_TOKEN,
} from '@/core/domain/tokenUsage/contracts/tokenUsage.service.contract';
import { TokenUsageQueryDto } from '@/core/infrastructure/http/dtos/token-usage.dto';
import { Query, Controller, Get } from '@nestjs/common';
import {
    DailyUsageResultContract,
    TokenUsageQueryContract,
    UsageSummaryContract,
    DailyUsageByPrResultContract,
    UsageByPrResultContract,
    DailyUsageByDeveloperResultContract,
    UsageByDeveloperResultContract,
} from '@/core/domain/tokenUsage/types/tokenUsage.types';
import { TokensByDeveloperUseCase } from '@/core/application/use-cases/usage/tokens-developer.use-case';

@Controller('usage')
export class TokenUsageController {
    constructor(
        @Inject(TOKEN_USAGE_SERVICE_TOKEN)
        private readonly tokenUsageService: ITokenUsageService,

        private readonly tokensByDeveloperUseCase: TokensByDeveloperUseCase,
    ) {}

    @Get('tokens/summary')
    async getSummary(
        @Query() query: TokenUsageQueryDto,
    ): Promise<UsageSummaryContract> {
        const mapped = this.mapDtoToContract(query);
        return this.tokenUsageService.getSummary(mapped);
    }

    @Get('tokens/daily')
    async getDaily(
        @Query() query: TokenUsageQueryDto,
    ): Promise<DailyUsageResultContract[]> {
        const mapped = this.mapDtoToContract(query);
        return this.tokenUsageService.getDailyUsage(mapped);
    }

    @Get('tokens/by-pr')
    async getUsageByPr(
        @Query() query: TokenUsageQueryDto,
    ): Promise<UsageByPrResultContract[]> {
        const mapped = this.mapDtoToContract(query);
        return this.tokenUsageService.getUsageByPr(mapped);
    }

    @Get('tokens/daily-by-pr')
    async getDailyUsageByPr(
        @Query() query: TokenUsageQueryDto,
    ): Promise<DailyUsageByPrResultContract[]> {
        const mapped = this.mapDtoToContract(query);
        return this.tokenUsageService.getDailyUsageByPr(mapped);
    }

    @Get('tokens/by-developer')
    async getUsageByDeveloper(
        @Query() query: TokenUsageQueryDto,
    ): Promise<UsageByDeveloperResultContract[]> {
        const mapped = this.mapDtoToContract(query);
        return this.tokensByDeveloperUseCase.execute(mapped, false);
    }

    @Get('tokens/daily-by-developer')
    async getDailyByDeveloper(
        @Query() query: TokenUsageQueryDto,
    ): Promise<DailyUsageByDeveloperResultContract[]> {
        const mapped = this.mapDtoToContract(query);
        return this.tokensByDeveloperUseCase.execute(mapped, true);
    }

    // debug endpoint removed

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

        return {
            organizationId: query.organizationId,
            prNumber: query.prNumber,
            start,
            end,
            timezone: query.timezone || 'UTC',
            developer: query.developer,
        };
    }
}
