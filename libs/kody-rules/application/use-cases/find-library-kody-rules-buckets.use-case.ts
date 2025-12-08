import { createLogger } from '@kodus/flow';
import {
    KODY_RULES_SERVICE_TOKEN,
    IKodyRulesService,
} from '@libs/kody-rules/domain/contracts/kodyRules.service.contract';
import { BucketInfo } from '@libs/common/types/kodyRules.type';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class FindLibraryKodyRulesBucketsUseCase {
    private readonly logger = createLogger(
        FindLibraryKodyRulesBucketsUseCase.name,
    );
    constructor(
        @Inject(KODY_RULES_SERVICE_TOKEN)
        private readonly kodyRulesService: IKodyRulesService,
    ) {}

    async execute(): Promise<BucketInfo[]> {
        try {
            const buckets =
                await this.kodyRulesService.getLibraryKodyRulesBuckets();
            return buckets;
        } catch (error) {
            this.logger.error({
                message: 'Error finding library Kody Rules buckets',
                context: FindLibraryKodyRulesBucketsUseCase.name,
                error: error,
            });
            throw error;
        }
    }
}
