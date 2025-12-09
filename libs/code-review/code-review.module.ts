import { CODE_BASE_CONFIG_SERVICE_TOKEN } from '@libs/core/domain/codeBase/contracts/CodeBaseConfigService.contract';
import { COMMENT_MANAGER_SERVICE_TOKEN } from '@libs/core/domain/codeBase/contracts/CommentManagerService.contract';
import { PULL_REQUEST_MANAGER_SERVICE_TOKEN } from '@libs/core/domain/codeBase/contracts/PullRequestManagerService.contract';
import { SUGGESTION_SERVICE_TOKEN } from '@libs/core/domain/codeBase/contracts/SuggestionService.contract';
import { CodeReviewHandlerService } from '@libs/core/infrastructure/adapters/services/codeBase/codeReviewHandlerService.service';
import { CommentAnalysisService } from '@libs/core/infrastructure/adapters/services/codeBase/commentAnalysis.service';
import { CommentManagerService } from '@libs/core/infrastructure/adapters/services/codeBase/commentManager.service';
import {
    LLM_ANALYSIS_SERVICE_TOKEN,
    LLMAnalysisService,
} from '@libs/core/infrastructure/adapters/services/codeBase/llmAnalysis.service';
import { PullRequestHandlerService } from '@libs/core/infrastructure/adapters/services/codeBase/pullRequestManager.service';
import { forwardRef, Module } from '@nestjs/common';
import { AutomationModule } from '@libs/automation/automation.module';
import { AutomationStrategyModule } from '@libs/automation/modules/automationStrategy.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';
import { IntegrationModule } from '@libs/integrations/integrations.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { KodyRulesModule } from '@libs/kody-rules/kody-rules.module';
import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PlatformModule } from '@libs/platform/platform.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { SuggestionEmbeddedModule } from '@libs/code-review/modules/suggestion.module';
import { TeamsModule } from '@libs/organization/modules/team.module';

import {
    CROSS_FILE_ANALYSIS_SERVICE_TOKEN,
    CrossFileAnalysisService,
} from '@libs/core/infrastructure/adapters/services/codeBase/crossFileAnalysis.service';
import { SuggestionService } from '@libs/core/infrastructure/adapters/services/codeBase/suggestion.service';
import { MessageTemplateProcessor } from '@libs/core/infrastructure/adapters/services/codeBase/utils/services/messageTemplateProcessor.service';
import { KodyFineTuningService } from '@libs/core/infrastructure/adapters/services/kodyFineTuning/kodyFineTuning.service';
import { PromptService } from '@libs/core/infrastructure/adapters/services/prompt.service';
import { CodeBaseController } from '@libs/core/infrastructure/http/controllers/codeBase.controller';
import { CodeAnalysisOrchestrator } from '@libs/ee/codeBase/codeAnalysisOrchestrator.service';
import CodeBaseConfigService from '@libs/ee/codeBase/codeBaseConfig.service';
import {
    KODY_RULES_ANALYSIS_SERVICE_TOKEN,
    KodyRulesAnalysisService,
} from '@libs/ee/codeBase/kodyRulesAnalysis.service';
import {
    KODY_RULES_PR_LEVEL_ANALYSIS_SERVICE_TOKEN,
    KodyRulesPrLevelAnalysisService,
} from '@libs/ee/codeBase/kodyRulesPrLevelAnalysis.service';
import { FileReviewModule } from '@libs/ee/codeReview/fileReviewContextPreparation/fileReview.module';
import { KodyASTAnalyzeContextModule } from '@libs/ee/kodyASTAnalyze/kodyAstAnalyzeContext.module';
import { LicenseModule } from '@libs/ee/license/license.module';
import { LicenseService } from '@libs/ee/license/license.service';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { CodeReviewPipelineModule } from '@libs/code-review/modules/pipeline.module';
import { ContextReferenceModule } from '@libs/code-review/modules/contextReference.module';
import { GlobalParametersModule } from '@libs/global-parameters.module';
import { KodyFineTuningContextModule } from '@libs/kodyFineTuningContext.module';
import { PipelineModule } from '@libs/pipeline.module';
import { TokenChunkingModule } from '@libs/tokenChunking.module';

@Module({
    imports: [
        forwardRef(() => IntegrationModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => AutomationStrategyModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => KodyRulesModule),
        forwardRef(() => PullRequestsModule),
        forwardRef(() => SuggestionEmbeddedModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => CodeReviewFeedbackModule),
        forwardRef(() => FileReviewModule),
        forwardRef(() => CodeReviewPipelineModule),
        forwardRef(() => PipelineModule),
        forwardRef(() => KodyFineTuningContextModule),
        forwardRef(() => KodyASTAnalyzeContextModule),
        forwardRef(() => GlobalParametersModule),
        forwardRef(() => TokenChunkingModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => ContextReferenceModule),
        forwardRef(() => PermissionValidationModule),
    ],
    providers: [
        {
            provide: LLM_ANALYSIS_SERVICE_TOKEN,
            useClass: LLMAnalysisService,
        },
        {
            provide: CODE_BASE_CONFIG_SERVICE_TOKEN,
            useClass: CodeBaseConfigService,
        },
        {
            provide: PULL_REQUEST_MANAGER_SERVICE_TOKEN,
            useClass: PullRequestHandlerService,
        },
        {
            provide: COMMENT_MANAGER_SERVICE_TOKEN,
            useClass: CommentManagerService,
        },
        {
            provide: KODY_RULES_ANALYSIS_SERVICE_TOKEN,
            useClass: KodyRulesAnalysisService,
        },
        {
            provide: KODY_RULES_PR_LEVEL_ANALYSIS_SERVICE_TOKEN,
            useClass: KodyRulesPrLevelAnalysisService,
        },
        {
            provide: CROSS_FILE_ANALYSIS_SERVICE_TOKEN,
            useClass: CrossFileAnalysisService,
        },
        {
            provide: SUGGESTION_SERVICE_TOKEN,
            useClass: SuggestionService,
        },
        PromptService,
        CodeAnalysisOrchestrator,
        CodeReviewHandlerService,
        KodyFineTuningService,
        CommentAnalysisService,
        MessageTemplateProcessor,
        LicenseService,
    ],
    exports: [
        PULL_REQUEST_MANAGER_SERVICE_TOKEN,
        LLM_ANALYSIS_SERVICE_TOKEN,
        COMMENT_MANAGER_SERVICE_TOKEN,
        CODE_BASE_CONFIG_SERVICE_TOKEN,
        KODY_RULES_ANALYSIS_SERVICE_TOKEN,
        KODY_RULES_PR_LEVEL_ANALYSIS_SERVICE_TOKEN,
        CROSS_FILE_ANALYSIS_SERVICE_TOKEN,
        SUGGESTION_SERVICE_TOKEN,
        PromptService,
        CodeAnalysisOrchestrator,
        KodyFineTuningService,
        CodeReviewHandlerService,
        CommentAnalysisService,
        MessageTemplateProcessor,
    ],
    controllers: [CodeBaseController],
})
export class CodebaseModule {}
