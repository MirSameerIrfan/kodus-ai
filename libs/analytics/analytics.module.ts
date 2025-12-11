import { Module } from '@nestjs/common';

import { TOKEN_USAGE_REPOSITORY_TOKEN } from './domain/token-usage/contracts/tokenUsage.repository.contract';
import { TOKEN_USAGE_SERVICE_TOKEN } from './domain/token-usage/contracts/tokenUsage.service.contract';

import { TokenUsageRepository } from './infrastructure/adapters/repositories/tokenUsage.repository';
import { TokenUsageService } from './infrastructure/adapters/services/tokenUsage.service';

import { TrackUseCase } from './application/use-cases/segment/track.use-case';
import { TokenPricingUseCase } from './application/use-cases/usage/token-pricing.use-case';
import { TokensDeveloperUseCase } from './application/use-cases/usage/tokens-developer.use-case';
import { CostEstimateUseCase } from './application/use-cases/usage/cost-estimate.use-case';

@Module({
    providers: [
        {
            provide: TOKEN_USAGE_REPOSITORY_TOKEN,
            useClass: TokenUsageRepository,
        },
        { provide: TOKEN_USAGE_SERVICE_TOKEN, useClass: TokenUsageService },
        TrackUseCase,
        TokenPricingUseCase,
        TokensDeveloperUseCase,
        CostEstimateUseCase,
    ],
    exports: [
        TOKEN_USAGE_SERVICE_TOKEN,
        TrackUseCase,
        TokenPricingUseCase,
        TokensDeveloperUseCase,
        CostEstimateUseCase,
    ],
})
export class AnalyticsModule {}
