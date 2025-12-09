import { OrganizationParametersKey } from '@libs/core/domain/enums';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { PinoLoggerService } from '@libs/log/pino.service';
import {
    IOrganizationParametersService,
    ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/organizationParameters/contracts/organizationParameters.service.contract';
import {
    DEFAULT_COCKPIT_METRICS_VISIBILITY,
    ICockpitMetricsVisibility,
} from '@libs/organization/domain/organizationParameters/interfaces/cockpit-metrics-visibility.interface';
import { Inject, Injectable } from '@nestjs/common';

export const GET_COCKPIT_METRICS_VISIBILITY_USE_CASE_TOKEN = Symbol(
    'GET_COCKPIT_METRICS_VISIBILITY_USE_CASE_TOKEN',
);

@Injectable()
export class GetCockpitMetricsVisibilityUseCase {
    constructor(
        @Inject(ORGANIZATION_PARAMETERS_SERVICE_TOKEN)
        private readonly organizationParametersService: IOrganizationParametersService,
        private readonly logger: PinoLoggerService,
    ) {}

    async execute(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<ICockpitMetricsVisibility> {
        try {
            const parameter =
                await this.organizationParametersService.findByKey(
                    OrganizationParametersKey.COCKPIT_METRICS_VISIBILITY,
                    organizationAndTeamData,
                );

            if (!parameter) {
                this.logger.log({
                    message:
                        'Cockpit metrics visibility config not found, returning default values (all true)',
                    context: GetCockpitMetricsVisibilityUseCase.name,
                    metadata: {
                        organizationId: organizationAndTeamData.organizationId,
                    },
                });
                return DEFAULT_COCKPIT_METRICS_VISIBILITY;
            }

            return parameter.configValue as ICockpitMetricsVisibility;
        } catch (error) {
            this.logger.error({
                message:
                    'Error getting cockpit metrics visibility, returning default values',
                context: GetCockpitMetricsVisibilityUseCase.name,
                error: error,
                metadata: {
                    organizationAndTeamData,
                },
            });

            return DEFAULT_COCKPIT_METRICS_VISIBILITY;
        }
    }
}
