import { Global, Module, forwardRef } from '@nestjs/common';
import { GET_ADDITIONAL_INFO_HELPER_TOKEN } from '@libs/core/domain/contracts';
import { GetAdditionalInfoHelper } from '../utils/helpers/getAdditionalInfo.helper';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { IntegrationCoreModule } from '@libs/integrations/modules/integrations-core.module';
import { IntegrationConfigCoreModule } from '@libs/integrations/modules/config-core.module';

@Global()
@Module({
    imports: [
        forwardRef(() => ParametersModule),
        forwardRef(() => IntegrationCoreModule),
        forwardRef(() => IntegrationConfigCoreModule),
    ],
    providers: [
        {
            provide: GET_ADDITIONAL_INFO_HELPER_TOKEN,
            useClass: GetAdditionalInfoHelper,
        },
    ],
    exports: [GET_ADDITIONAL_INFO_HELPER_TOKEN],
})
export class SharedHelpersModule {}
