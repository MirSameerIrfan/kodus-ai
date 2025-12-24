import { Module, forwardRef } from '@nestjs/common';

import { CodebaseModule } from '@libs/code-review/modules/codebase.module'; // Will be CodebaseCoreModule later
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { CodeReviewCoreModule } from './code-review-core.module';

@Module({
    imports: [
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => CodebaseModule), // Should point to Core when ready
        CodeReviewCoreModule,
    ],
    exports: [CodeReviewCoreModule],
})
export class PullRequestsModule {}
