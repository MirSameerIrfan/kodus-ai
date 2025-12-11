import { Module } from '@nestjs/common';
import { IssuesController } from '@apps/api/controllers/issues.controller';
import { IssuesCoreModule } from './issues-core.module';

@Module({
    imports: [IssuesCoreModule],
    controllers: [IssuesController],
    providers: [],
    exports: [],
})
export class IssuesModule {}
