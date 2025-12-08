import { GlobalParametersKey } from '@libs/common/enums/global-parameters-key.enum';

export interface IGlobalParameters {
    uuid: string;
    configKey: GlobalParametersKey;
    configValue: any;
}
