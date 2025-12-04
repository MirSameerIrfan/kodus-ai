import { UserRequest } from '@/config/types/http/user-request.type';
import { CreateOrUpdateSSOConfigUseCase } from '@/core/application/use-cases/ssoConfig/create-or-update.use-case';
import {
    ISSOConfigService,
    SSO_CONFIG_SERVICE_TOKEN,
} from '@/core/domain/auth/contracts/ssoConfig.service.contract';
import {
    SSOProtocol,
    SSOProtocolConfigMap,
} from '@/core/domain/auth/interfaces/ssoConfig.interface';
import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

@Controller('sso-config')
export class SSOConfigController {
    constructor(
        private readonly createOrUpdateSSOConfigUseCase: CreateOrUpdateSSOConfigUseCase,

        @Inject(SSO_CONFIG_SERVICE_TOKEN)
        private readonly ssoConfigService: ISSOConfigService,

        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    @Post()
    async createOrUpdate(
        @Body()
        body: {
            uuid?: string;
            protocol?: SSOProtocol;
            providerConfig?: SSOProtocolConfigMap[SSOProtocol];
            active?: boolean;
            domains?: string[];
        },
    ) {
        const organizationId = this.request?.user?.organization?.uuid;

        if (!organizationId) {
            throw new Error('Organization not found');
        }

        return await this.createOrUpdateSSOConfigUseCase.execute({
            ...body,
            organizationId,
        });
    }

    @Get()
    async getSSOConfigs(
        @Query('protocol') protocol?: SSOProtocol,
        @Query('active') active?: boolean,
    ) {
        const organizationId = this.request?.user?.organization?.uuid;

        if (!organizationId) {
            throw new Error('Organization not found');
        }

        const ssoConfig = await this.ssoConfigService.findOne({
            active,
            organization: {
                uuid: organizationId,
            },
            protocol,
        });

        if (!ssoConfig) {
            return null;
        }

        return ssoConfig.toJson();
    }
}
