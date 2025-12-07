import { createLogger } from "@kodus/flow";
import { OrganizationAndTeamData } from '@/config/types/general/organizationAndTeamData';
import {
    DRY_RUN_SERVICE_TOKEN,
    IDryRunService,
} from '@libs/dry-run/domain/contracts/dryRun.service.contract';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class GetStatusDryRunUseCase {
    private readonly logger = createLogger(GetStatusDryRunUseCase.name);
    constructor(
        @Inject(DRY_RUN_SERVICE_TOKEN)
        private readonly dryRunService: IDryRunService
    ) {}

    async execute(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        correlationId: string;
    }) {
        const { organizationAndTeamData, correlationId } = params;

        try {
            const dryRun = await this.dryRunService.findDryRunById({
                organizationAndTeamData,
                id: correlationId,
            });

            if (!dryRun) {
                this.logger.warn({
                    message: 'Dry run not found',
                    context: GetStatusDryRunUseCase.name,
                    serviceName: GetStatusDryRunUseCase.name,
                    metadata: {
                        organizationAndTeamData,
                        correlationId,
                    },
                });

                return null;
            }

            return dryRun.status;
        } catch (error) {
            this.logger.error({
                message: 'Error getting dry run status',
                context: GetStatusDryRunUseCase.name,
                serviceName: GetStatusDryRunUseCase.name,
                error,
                metadata: {
                    organizationAndTeamData,
                    correlationId,
                },
            });

            throw error;
        }
    }
}
