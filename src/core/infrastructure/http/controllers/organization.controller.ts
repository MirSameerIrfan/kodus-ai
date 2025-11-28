import { GetOrganizationNameUseCase } from '@/core/application/use-cases/organization/get-organization-name';
import { GetOrganizationsByDomainUseCase } from '@/core/application/use-cases/organization/get-organizations-domain.use-case';
import { UpdateInfoOrganizationAndPhoneUseCase } from '@/core/application/use-cases/organization/update-infos.use-case';
import {
    Action,
    ResourceType,
} from '@/core/domain/permissions/enums/permissions.enum';
import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import {
    CheckPolicies,
    PolicyGuard,
} from '../../adapters/services/permissions/policy.guard';
import { checkPermissions } from '../../adapters/services/permissions/policy.handlers';
import { UpdateInfoOrganizationAndPhoneDto } from '../dtos/updateInfoOrgAndPhone.dto';

@Controller('organization')
export class OrganizationController {
    constructor(
        private readonly getOrganizationNameUseCase: GetOrganizationNameUseCase,
        private readonly updateInfoOrganizationAndPhoneUseCase: UpdateInfoOrganizationAndPhoneUseCase,
        private readonly getOrganizationsByDomainUseCase: GetOrganizationsByDomainUseCase,
    ) {}

    @Get('/name')
    public getOrganizationName() {
        return this.getOrganizationNameUseCase.execute();
    }

    @Patch('/update-infos')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.OrganizationSettings
        }),
    )
    public async updateInfoOrganizationAndPhone(
        @Body() body: UpdateInfoOrganizationAndPhoneDto,
    ) {
        return await this.updateInfoOrganizationAndPhoneUseCase.execute(body);
    }

    @Get('/domain')
    public async getOrganizationsByDomain(
        @Query('domain')
        domain: string,
    ) {
        return await this.getOrganizationsByDomainUseCase.execute(domain);
    }
}
