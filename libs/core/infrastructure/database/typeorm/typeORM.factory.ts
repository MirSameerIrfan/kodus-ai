import { join } from 'path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

import {
    DatabaseConnection,
} from '@libs/core/infrastructure/config/types';

@Injectable()
export class TypeORMFactory implements TypeOrmOptionsFactory {
    protected config: DatabaseConnection;

    constructor(private readonly configService: ConfigService) {
        this.config = configService.get<DatabaseConnection>('postgresDatabase');

        if (!this.config) {
            throw new Error('Database configuration not found!');
        }
    }

    createTypeOrmOptions(): TypeOrmModuleOptions {
        const env = process.env.API_DATABASE_ENV ?? process.env.API_NODE_ENV;
        const isProduction = !['development', 'test'].includes(env);

        // Detecta tipo de componente para ajustar pool de conexões
        const componentType = process.env.COMPONENT_TYPE || 'default';

        // Configuração de pool por componente (otimização de escalabilidade)
        const poolConfigs = {
            webhook: { max: 8, min: 1 }, // Webhook handler: leve, só escreve logs
            api: { max: 25, min: 2 }, // API REST: consultas variadas
            worker: { max: 12, min: 2 }, // Workers: processamento pesado
            default: { max: 40, min: 1 }, // Fallback: comportamento original
        };
        const poolConfig = poolConfigs[componentType] || poolConfigs.default;

        const optionsTypeOrm: TypeOrmModuleOptions = {
            type: 'postgres',
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            password: this.config.password,
            database: this.config.database,
            entities: [
                join(
                    __dirname,
                    '../../../core/infrastructure/adapters/repositories/typeorm/schema/*.model{.ts,.js}',
                ),
            ],
            autoLoadEntities: true,
            cache: false,
            migrationsRun: false,
            migrations: [join(__dirname, './migrations/*{.ts,.js}')],
            migrationsTableName: 'migrations',
            synchronize: false,
            logging: false,
            logger: 'file',
            ssl: isProduction,
            extra: {
                max: poolConfig.max,
                min: poolConfig.min,
                idleTimeoutMillis: 10000,
                connectionTimeoutMillis: 2000,
                keepAlive: true,
                ...(isProduction
                    ? {
                          ssl: {
                              rejectUnauthorized: false,
                          },
                      }
                    : {}),
            },
        };

        return optionsTypeOrm;
    }
}
