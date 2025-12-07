import {
    TokenUsageQueryContract,
    DailyUsageResultContract,
    UsageSummaryContract,
    DailyUsageByPrResultContract,
    UsageByPrResultContract,
} from '../types/tokenUsage.types';

export const TOKEN_USAGE_REPOSITORY_TOKEN = Symbol('TokenUsageRepository');

export interface ITokenUsageRepository {
    getSummary(query: TokenUsageQueryContract): Promise<UsageSummaryContract>;

    getDailyUsage(
        query: TokenUsageQueryContract,
    ): Promise<DailyUsageResultContract[]>;

    getUsageByPr(
        query: TokenUsageQueryContract,
    ): Promise<UsageByPrResultContract[]>;

    getDailyUsageByPr(
        query: TokenUsageQueryContract,
    ): Promise<DailyUsageByPrResultContract[]>;
}
