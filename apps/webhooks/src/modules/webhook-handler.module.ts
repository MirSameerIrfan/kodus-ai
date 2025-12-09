import { Module } from '@nestjs/common';

import { WebhookHandlerBaseModule } from './webhook-handler-base.module';
import { AzureReposController } from '../controllers/azureRepos.controller';
import { BitbucketController } from '../controllers/bitbucket.controller';
import { GithubController } from '../controllers/github.controller';
import { GitlabController } from '../controllers/gitlab.controller';
import { WebhookHealthController } from '../controllers/webhook-health.controller';

@Module({
    imports: [WebhookHandlerBaseModule],
    controllers: [
        GithubController,
        GitlabController,
        BitbucketController,
        AzureReposController,
        WebhookHealthController,
    ],
})
export class WebhookHandlerModule {}
