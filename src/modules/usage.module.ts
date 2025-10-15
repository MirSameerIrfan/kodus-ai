import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogModelInstance } from '@/core/infrastructure/adapters/repositories/mongoose/schema';
import { TokenUsageService } from '@/core/infrastructure/adapters/services/usage/tokenUsage.service';
import { TokenUsageController } from '@/core/infrastructure/http/controllers/tokenUsage.controller';
import { TokenUsageRepository } from '@/core/infrastructure/adapters/repositories/mongoose/tokenUsage.repository';
import { TOKEN_USAGE_REPOSITORY_TOKEN } from '@/core/domain/tokenUsage/contracts/tokenUsage.repository.contract';
import { TOKEN_USAGE_SERVICE_TOKEN } from '@/core/domain/tokenUsage/contracts/tokenUsage.service.contract';
import {
    ObservabilityTelemetryModel,
    ObservabilityTelemetryModelSchema,
} from '@/core/infrastructure/adapters/repositories/mongoose/schema/observabilityTelemetry.model';
import { UseCases } from '@/core/application/use-cases/usage';
import { PullRequestsModule } from './pullRequests.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            LogModelInstance,
            {
                name: ObservabilityTelemetryModel.name,
                schema: ObservabilityTelemetryModelSchema,
            },
        ]),
        forwardRef(() => PullRequestsModule),
    ],
    providers: [
        ...UseCases,
        { provide: TOKEN_USAGE_SERVICE_TOKEN, useClass: TokenUsageService },
        {
            provide: TOKEN_USAGE_REPOSITORY_TOKEN,
            useClass: TokenUsageRepository,
        },
    ],
    controllers: [TokenUsageController],
    exports: [TOKEN_USAGE_SERVICE_TOKEN],
})
export class UsageModule {}
