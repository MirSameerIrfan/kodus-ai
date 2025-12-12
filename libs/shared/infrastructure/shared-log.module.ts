import { Global, Module } from '@nestjs/common';
import { KodusLoggerService } from '@libs/core/log/kodus-logger.service';

@Global()
@Module({
    providers: [KodusLoggerService],
    exports: [KodusLoggerService],
})
export class SharedLogModule {}
