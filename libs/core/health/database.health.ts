import { Injectable } from '@nestjs/common';
import {
    TypeOrmHealthIndicator,
    MongooseHealthIndicator,
} from '@nestjs/terminus';

@Injectable()
export class DatabaseHealthIndicator {
    constructor(
        private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
        private readonly mongooseHealthIndicator: MongooseHealthIndicator,
    ) {}

    async isDatabaseHealthy() {
        const postgres = await this.typeOrmHealthIndicator.pingCheck(
            'postgres',
            {
                timeout: 5000,
            },
        );
        const mongo = await this.mongooseHealthIndicator.pingCheck('mongodb', {
            timeout: 5000,
        });

        return {
            database: {
                status:
                    postgres.postgres.status === 'up' &&
                    mongo.mongodb.status === 'up'
                        ? 'up'
                        : 'down',
                postgres: postgres.postgres,
                mongodb: mongo.mongodb,
            },
        };
    }
}
