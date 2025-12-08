import { PlatformType } from '@libs/common/enums/platform-type.enum';
import { SetMetadata } from '@nestjs/common';

export const IntegrationServiceDecorator = (
    type: PlatformType,
    serviceType: 'projectManagement' | 'codeManagement' | 'communication',
) => {
    return SetMetadata('integration', { type, serviceType });
};
