import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    MongooseModuleOptions,
    MongooseOptionsFactory,
} from '@nestjs/mongoose';
import { ConnectionString } from 'connection-string';
import mongoose from 'mongoose';

import { DatabaseConnection } from '@libs/core/infrastructure/config/types';

import { MongooseConnectionFactory } from './mongoose-connection.factory';

@Injectable()
export class MongooseFactory implements MongooseOptionsFactory {
    protected config: DatabaseConnection;

    constructor(private readonly configService: ConfigService) {
        this.config = configService.get<DatabaseConnection>('mongoDatabase');
    }

    public createMongooseOptions(): MongooseModuleOptions {
        const env = process.env.API_DATABASE_ENV ?? process.env.API_NODE_ENV;
        const isProduction = !['development', 'test'].includes(env ?? '');

        if (!isProduction) {
            mongoose.set('debug', true);
        }

        let uri = new ConnectionString('', {
            user: this.config.username,
            password: this.config.password,
            protocol: this.config.port ? 'mongodb' : 'mongodb+srv',
            hosts: [{ name: this.config.host, port: this.config.port }],
        }).toString();

        const { createForInstance } = MongooseConnectionFactory;

        const shouldAppendClusterConfig =
            isProduction && !!process.env.API_MG_DB_PRODUCTION_CONFIG;

        if (shouldAppendClusterConfig) {
            uri = `${uri}/${process.env.API_MG_DB_PRODUCTION_CONFIG}`;
        }

        // Detect component type to adjust connection pool
        const componentType = process.env.COMPONENT_TYPE || 'default';

        // Pool configuration per component
        const poolConfigs = {
            webhook: { max: 10, min: 2 }, // Webhook: focused on ingestion, usually high concurrency but short-lived ops
            api: { max: 50, min: 5 }, // API: higher concurrency for reads/writes
            worker: { max: 20, min: 5 }, // Worker: processing batches
            default: { max: 100, min: 5 }, // Fallback: default mongoose value is 100
        };
        const poolConfig = poolConfigs[componentType] || poolConfigs.default;

        return {
            uri: uri,
            dbName: this.config.database,
            connectionFactory: createForInstance,
            minPoolSize: poolConfig.min,
            maxPoolSize: poolConfig.max,
            maxIdleTimeMS: 50000,
        };
    }
}
