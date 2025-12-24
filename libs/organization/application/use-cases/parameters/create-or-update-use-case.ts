import { Inject, Injectable } from '@nestjs/common';

import { createLogger } from '@kodus/flow';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import { ParametersKey } from '@libs/core/domain/enums';
import { ParametersEntity } from '@libs/organization/domain/parameters/entities/parameters.entity';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';

@Injectable()
export class CreateOrUpdateParametersUseCase {
    private readonly logger = createLogger(
        CreateOrUpdateParametersUseCase.name,
    );

    constructor(
        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,
    ) {}

    async execute<K extends ParametersKey>(
        parametersKey: K,
        configValue: ParametersEntity<K>['configValue'],
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<ParametersEntity<K> | boolean> {
        try {
            return await this.parametersService.createOrUpdateConfig(
                parametersKey,
                configValue,
                organizationAndTeamData,
            );
        } catch (error) {
            this.logger.error({
                message: 'Error creating or updating parameters',
                context: CreateOrUpdateParametersUseCase.name,
                error: error,
                metadata: {
                    parametersKey,
                    configValue,
                    organizationAndTeamData,
                },
            });
            throw new Error('Error creating or updating parameters');
        }
    }
}
