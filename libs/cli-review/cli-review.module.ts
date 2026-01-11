import { Module, forwardRef } from '@nestjs/common';

// Pipeline
import { CliReviewPipelineStrategy } from './pipeline/strategy/cli-review-pipeline.strategy';
import { PrepareCliFilesStage } from './pipeline/stages/prepare-cli-files.stage';
import { FormatCliOutputStage } from './pipeline/stages/format-cli-output.stage';

// Use Cases
import { ExecuteCliReviewUseCase } from './application/use-cases/execute-cli-review.use-case';

// Services
import { CliInputConverter } from './infrastructure/converters/cli-input.converter';
import { TrialRateLimiterService } from './infrastructure/services/trial-rate-limiter.service';

// External dependencies
import { CodeReviewPipelineModule } from '@libs/code-review/pipeline/code-review-pipeline.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { TeamModule } from '@libs/organization/modules/team.module';
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { LicenseModule } from '@libs/ee/license/license.module';

/**
 * Module for CLI code review functionality
 * Provides a simplified pipeline for analyzing code from CLI
 */
@Module({
    imports: [
        forwardRef(() => CodeReviewPipelineModule), // For reusing stages
        forwardRef(() => ParametersModule), // For config loading
        forwardRef(() => TeamModule), // For Team CLI Key validation
        forwardRef(() => GlobalCacheModule), // For rate limiting
        forwardRef(() => AutomationModule), // For tracking executions
        forwardRef(() => LicenseModule), // For license validation and auto-assign
    ],
    providers: [
        // Strategy
        CliReviewPipelineStrategy,

        // Stages
        PrepareCliFilesStage,
        FormatCliOutputStage,

        // Use Cases
        ExecuteCliReviewUseCase,

        // Services
        CliInputConverter,
        TrialRateLimiterService,
    ],
    exports: [
        // Export use case and services for controllers
        ExecuteCliReviewUseCase,
        TrialRateLimiterService,
    ],
})
export class CliReviewModule {}
