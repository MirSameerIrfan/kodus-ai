import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMFactory } from '@core/database/typeorm/typeORM.factory';
import { postgresConfigLoader } from '@core/config/loaders/postgres.config.loader';
import { MongooseModule } from '@nestjs/mongoose';
import { MongooseFactory } from '@core/database/mongodb/mongoose.factory';
import { mongoDBConfigLoader } from '@core/config/loaders/mongodb.config.loader';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule.forFeature(postgresConfigLoader)],
            inject: [ConfigService],
            useClass: TypeORMFactory,
        }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule.forFeature(mongoDBConfigLoader)],
            inject: [ConfigService],
            useClass: MongooseFactory,
        }),
    ],
    providers: [],
    exports: [],
})
export class DatabaseModule {}
