import { forwardRef, Module } from '@nestjs/common';
import { AIEngineModule } from '@libs/ai-engine/ai-engine.module';

import { LLMAnalysisService } from '@libs/code-review/infrastructure/services/llm-analysis.service';
import { CodeBaseConfigService } from '@libs/code-review/infrastructure/services/codebase-config.service';
import { PullRequestHandlerService } from '@libs/code-review/infrastructure/services/pull-request-handler.service';
import { CommentManagerService } from '@libs/code-review/infrastructure/services/comment-manager.service';
import { KodyRulesAnalysisService } from '@libs/code-review/infrastructure/services/kody-rules-analysis.service';
import { KodyRulesPrLevelAnalysisService } from '@libs/code-review/infrastructure/services/kody-rules-pr-level-analysis.service';
import { CrossFileAnalysisService } from '@libs/code-review/infrastructure/services/cross-file-analysis.service';
import { SuggestionService } from '@libs/code-review/infrastructure/services/suggestion.service';
import { PromptService } from '@libs/agents/infrastructure/services/prompt.service';
import { CodeAnalysisOrchestrator } from '@libs/ee/codeBase/codeAnalysisOrchestrator.service';
import { CodeReviewHandlerService } from '@libs/code-review/infrastructure/services/code-review-handler.service';
import { KodyFineTuningService } from '@libs/kodyFineTuning/infrastructure/services/kodyFineTuning.service';
import { CommentAnalysisService } from '@libs/code-review/infrastructure/services/comment-analysis.service';
import { MessageTemplateProcessor } from '@libs/code-review/infrastructure/services/message-template-processor.service';
import { LicenseService } from '@libs/ee/license/license.service';

import { LLM_ANALYSIS_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/llm-analysis.service.contract';
import { CODE_BASE_CONFIG_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/codebase-config.service.contract';
import { PULL_REQUEST_MANAGER_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/pull-request-manager.service.contract';
import { COMMENT_MANAGER_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/comment-manager.service.contract';
import { KODY_RULES_ANALYSIS_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/kody-rules-analysis.service.contract';
import { KODY_RULES_PR_LEVEL_ANALYSIS_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/kody-rules-pr-level-analysis.service.contract';
import { CROSS_FILE_ANALYSIS_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/cross-file-analysis.service.contract';
import { SUGGESTION_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/suggestion.service.contract';

import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';
import { ParametersCoreModule } from '@libs/organization/modules/parameters-core.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { AutomationStrategyModule } from '@libs/automation/modules/automationStrategy.module';
import { AutomationModule } from '@libs/automation/modules/automation.module';
import { TeamCoreModule } from '@libs/organization/modules/team-core.module';
import { KodyRulesCoreModule } from '@libs/kodyRules/kody-rules-core.module';
import { PullRequestsCoreModule } from '@libs/code-review/modules/pull-requests-core.module';
import { SuggestionEmbeddedModule } from '@libs/kodyFineTuning/domain/suggestionEmbedded/suggestionEmbedded.module'; // Check
// import { OrganizationParametersModule } from '@libs/organization/modules/org-parameters.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';
import { FileReviewModule } from '@libs/ee/codeReview/fileReviewContextPreparation/fileReview.module';
import { CodeReviewPipelineModule } from '@libs/code-review/pipeline/code-review-pipeline.module';
import { PipelineModule } from '@libs/core/infrastructure/pipeline/pipeline.module'; // Check
import { KodyFineTuningContextModule } from '@libs/kodyFineTuning/infrastructure/kodyFineTuningContext.module'; // Check
import { KodyASTAnalyzeContextModule } from '@libs/ee/kodyASTAnalyze/kodyAstAnalyzeContext.module'; // Check
import { GlobalParametersModule } from '@libs/organization/modules/global-parameters.module'; // Check
import { TokenChunkingModule } from '@libs/core/infrastructure/services/tokenChunking/tokenChunking.module'; // Check
import { LicenseModule } from '@libs/ee/license/license.module';
import { ContextReferenceModule } from '@libs/code-review/modules/contextReference.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';

@Module({
    imports: [
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
        forwardRef(() => ParametersCoreModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => AutomationStrategyModule),
        forwardRef(() => AutomationModule),
        forwardRef(() => TeamCoreModule),
        forwardRef(() => KodyRulesCoreModule),
        forwardRef(() => PullRequestsCoreModule),
        forwardRef(() => SuggestionEmbeddedModule),
        // forwardRef(() => OrganizationParametersModule),
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
        AIEngineModule,
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
})
export class CodebaseCoreModule {}
