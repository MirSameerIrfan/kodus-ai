import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { mongoDBConfigLoader } from '@libs/core/infrastructure/config/loaders/mongodb.config.loader';
import { MongooseFactory } from '@libs/core/infrastructure/database/mongodb/mongoose.factory';

@Module({})
export class SharedMongoModule {
    static forRoot(): DynamicModule {
        return {
            module: SharedMongoModule,
            imports: [
                MongooseModule.forRootAsync({
                    imports: [ConfigModule.forFeature(mongoDBConfigLoader)],
                    inject: [ConfigService],
                    useClass: MongooseFactory,
                }),
            ],
            exports: [MongooseModule],
        };
    }
}
