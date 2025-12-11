import { Module } from '@nestjs/common';
import { CodeBaseController } from '@libs/code-review/infrastructure/http/controllers/codeBase.controller';
import { CodebaseCoreModule } from './modules/codebase-core.module';

@Module({
    imports: [CodebaseCoreModule],
    controllers: [CodeBaseController],
    providers: [],
    exports: [],
})
export class CodebaseModule {}
