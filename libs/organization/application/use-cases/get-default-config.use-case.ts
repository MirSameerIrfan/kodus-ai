import { createLogger } from "@kodus/flow";
import { getDefaultKodusConfigFile } from '@/shared/utils/validateCodeReviewConfigFile';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetDefaultConfigUseCase {
    private readonly logger = createLogger(GetDefaultConfigUseCase.name);
    constructor() {}

    async execute() {
        try {
            return getDefaultKodusConfigFile();
        } catch (error) {
            this.logger.error({
                message: 'Error getting default Kodus config file',
                context: GetDefaultConfigUseCase.name,
                metadata: { error },
            });
            throw error;
        }
    }
}
