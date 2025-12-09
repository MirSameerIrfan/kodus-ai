import { Global, Module } from '@nestjs/common';
import { AST_ANALYSIS_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/ASTAnalysisService.contract';
import { CodeAstAnalysisService } from '@libs/code-review/ee/ast/codeASTAnalysis.service';
import { PlatformModule } from '@libs/platform/platform.module';
import { ContextReferenceModule } from '@libs/code-review/modules/context-reference.module';
import { environment } from '../configs/environment';

const staticImports = [PlatformModule, ContextReferenceModule];

const providers = [];
const moduleExports = [AST_ANALYSIS_SERVICE_TOKEN];

if (environment.API_CLOUD_MODE && process.env.API_ENABLE_CODE_REVIEW_AST) {
    providers.push({
        provide: AST_ANALYSIS_SERVICE_TOKEN,
        useClass: CodeAstAnalysisService,
    });
} else {
    // Self-hosted mode, provide null services
    providers.push({ provide: AST_ANALYSIS_SERVICE_TOKEN, useValue: null });
}

@Global()
@Module({
    imports: staticImports,
    providers,
    exports: moduleExports,
})
export class KodyASTModule {}
