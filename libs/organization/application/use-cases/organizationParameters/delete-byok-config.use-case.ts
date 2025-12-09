import {
    IOrganizationParametersService,
    ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/organizationParameters/contracts/organizationParameters.service.contract';
import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class DeleteByokConfigUseCase {
    constructor(
        @Inject(ORGANIZATION_PARAMETERS_SERVICE_TOKEN)
        private readonly organizationParametersService: IOrganizationParametersService,
    ) {}

    async execute(organizationId: string, configType: 'main' | 'fallback') {
        return await this.organizationParametersService.deleteByokConfig(
            organizationId,
            configType,
        );
    }
}
