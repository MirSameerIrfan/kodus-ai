import { forwardRef, Module } from '@nestjs/common';
import { AIEngineModule } from '@libs/core/ai-engine/ai-engine.module';

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
    controllers: [CodeBaseController],
})
export class CodebaseModule {}
