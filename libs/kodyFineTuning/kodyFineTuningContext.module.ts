import { Module, forwardRef } from '@nestjs/common';

import { SuggestionEmbeddedModule } from './suggestionEmbedded.module';
import { GlobalParametersModule } from '@libs/organization/modules/global-parameters.module';
import { PlatformDataModule } from '@libs/platformData/platformData.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';

import { KodyFineTuningService } from './infrastructure/adapters/services/kodyFineTuning.service';

@Module({
    imports: [
        SuggestionEmbeddedModule,
        GlobalParametersModule,
        forwardRef(() => PlatformDataModule),
        forwardRef(() => CodeReviewFeedbackModule),
    ],
    providers: [KodyFineTuningService],
    exports: [KodyFineTuningService],
})
export class KodyFineTuningContextModule {}
