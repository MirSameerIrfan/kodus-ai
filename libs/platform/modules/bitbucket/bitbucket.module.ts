import { Module } from '@nestjs/common';
import { BitbucketService } from './bitbucket.service';
import { BitbucketPullRequestHandler } from './bitbucketPullRequest.handler';

@Module({
    providers: [BitbucketService, BitbucketPullRequestHandler],
    exports: [BitbucketService, BitbucketPullRequestHandler],
})
export class BitbucketModule {}
