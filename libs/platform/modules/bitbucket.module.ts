import { Module } from '@nestjs/common';
import { BitbucketService } from '../infrastructure/adapters/services/bitbucket.service';
import { BitbucketPullRequestHandler } from '../infrastructure/webhooks/bitbucket/bitbucketPullRequest.handler';

@Module({
    providers: [BitbucketService, BitbucketPullRequestHandler],
    exports: [BitbucketService, BitbucketPullRequestHandler],
})
export class BitbucketModule {}
