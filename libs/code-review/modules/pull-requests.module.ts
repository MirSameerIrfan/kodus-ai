import { Module } from '@nestjs/common';
import { PullRequestController } from 'apps/api/src/controllers/pullRequest.controller';
import { PullRequestsCoreModule } from './pull-requests-core.module';

@Module({
    imports: [PullRequestsCoreModule],
    controllers: [PullRequestController],
    providers: [],
    exports: [],
})
export class PullRequestsModule {}
