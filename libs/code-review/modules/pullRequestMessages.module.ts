import { Module } from '@nestjs/common';
import { PullRequestMessagesCoreModule } from './pullRequestMessages-core.module';

@Module({
    imports: [PullRequestMessagesCoreModule],
    controllers: [],
    providers: [],
    exports: [],
})
export class PullRequestMessagesModule {}
