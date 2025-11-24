import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { join } from 'path';
import { DatabaseConnection, OptionsOrm } from '@/config/types';

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
                max: 40,
                min: 1,
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
