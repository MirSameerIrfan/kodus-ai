import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PullRequestsRepository } from './infrastructure/adapters/repositories/pullRequests.repository';
import { PULL_REQUESTS_REPOSITORY_TOKEN } from './domain/pullRequests/contracts/pullRequests.repository.contract';
import {
    PullRequest,
    PullRequestSchema,
} from './infrastructure/adapters/repositories/schemas/pullRequests.model';
import { LogModule } from '@libs/analytics/modules/log.module';

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: PullRequest.name, schema: PullRequestSchema },
        ]),
        LogModule,
    ],
    providers: [
        {
            provide: PULL_REQUESTS_REPOSITORY_TOKEN,
            useClass: PullRequestsRepository,
        },
    ],
    exports: [PULL_REQUESTS_REPOSITORY_TOKEN],
})
export class PlatformDataModule {}
