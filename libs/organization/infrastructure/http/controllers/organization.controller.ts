import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';

import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import { checkPermissions } from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';
import { GetOrganizationNameUseCase } from '@libs/organization/application/use-cases/get-organization-name.use-case';
import { GetOrganizationsByDomainUseCase } from '@libs/organization/application/use-cases/get-organizations-domain.use-case';
import { UpdateInfoOrganizationAndPhoneUseCase } from '@libs/organization/application/use-cases/update-infos.use-case';

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
        checkPermissions(Action.Update, ResourceType.OrganizationSettings),
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
