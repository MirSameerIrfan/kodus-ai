import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';

import { mongoDBConfigLoader } from '@libs/core/infrastructure/config/loaders/mongodb.config.loader';
import { postgresConfigLoader } from '@libs/core/infrastructure/config/loaders/postgres.config.loader';
import { MongooseFactory } from '@libs/core/infrastructure/database/mongodb/mongoose.factory';
import { TypeORMFactory } from '@libs/core/infrastructure/database/typeorm/typeORM.factory';


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
