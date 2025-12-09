import { LOG_REPOSITORY_TOKEN } from '@libs/log/domain/contracts/log.repository.contracts';
import { LOG_SERVICE_TOKEN } from '@libs/log/domain/contracts/log.service.contracts';
import { LogDatabaseRepository } from '@libs/analytics/infrastructure/repositories/mongoose/log.repository';
import { LogModelInstance } from '@libs/core/infrastructure/repositories/model/mongodb';
import { LogService } from '@libs/core/logging/log.service';
import { PinoLoggerService } from '@libs/core/logging/pino.service';
import { ObservabilityService } from '@libs/core/infrastructure/logging/observability.service';
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Global()
@Module({
    imports: [MongooseModule.forFeature([LogModelInstance])],
    providers: [
        PinoLoggerService,
        {
            provide: LOG_SERVICE_TOKEN,
            useClass: LogService,
        },
        {
            provide: LOG_REPOSITORY_TOKEN,
            useClass: LogDatabaseRepository,
        },
        ObservabilityService,
    ],
    exports: [
        LOG_SERVICE_TOKEN,
        LOG_REPOSITORY_TOKEN,
        PinoLoggerService,
        ObservabilityService,
    ],
})
export class LogModule {}
