import { Module, forwardRef } from '@nestjs/common';

import { ProfilesModule } from './profiles.module';

import { UserCoreModule } from './user-core.module';

@Module({
    imports: [forwardRef(() => ProfilesModule), UserCoreModule],
    exports: [UserCoreModule],
})
export class UserModule {}
