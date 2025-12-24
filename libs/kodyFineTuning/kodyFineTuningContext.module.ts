import { Module, forwardRef } from '@nestjs/common';

import { SuggestionEmbeddedModule } from './suggestionEmbedded.module';
import { GlobalParametersModule } from '@libs/organization/modules/global-parameters.module';
import { PlatformDataModule } from '@libs/platformData/platformData.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';

import { KodyFineTuningService } from './infrastructure/adapters/services/kodyFineTuning.service';
import { KodyFineTuningContextPreparationService } from './infrastructure/adapters/services/fineTuningContext/fine-tuning.service';
import { KODY_FINE_TUNING_CONTEXT_PREPARATION_TOKEN } from '@libs/core/domain/interfaces/kody-fine-tuning-context-preparation.interface';

@Module({
    imports: [
        SuggestionEmbeddedModule,
        GlobalParametersModule,
        forwardRef(() => PlatformDataModule),
        forwardRef(() => CodeReviewFeedbackModule),
    ],
    providers: [
        KodyFineTuningService,
        {
            provide: KODY_FINE_TUNING_CONTEXT_PREPARATION_TOKEN,
            useClass: KodyFineTuningContextPreparationService,
        },
    ],
    exports: [
        KodyFineTuningService,
        KODY_FINE_TUNING_CONTEXT_PREPARATION_TOKEN,
    ],
})
export class KodyFineTuningContextModule {}
