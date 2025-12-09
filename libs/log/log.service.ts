import { Inject, Injectable } from '@nestjs/common';
import { ILogService } from './domain/contracts/log.service.contracts';
import {
    ILogRepository,
    LOG_REPOSITORY_TOKEN,
} from './domain/contracts/log.repository.contracts';
import { ILog } from './domain/interfaces/log.interface';
import { LogEntity } from './domain/entities/log.entity';

@Injectable()
export class LogService implements ILogService {
    constructor(
        @Inject(LOG_REPOSITORY_TOKEN)
        private readonly logRepository: ILogRepository,
    ) {}

    createMany(logs: Array<Omit<ILog, 'uuid'>>): Promise<void> {
        return this.logRepository.createMany(logs);
    }

    findOne(filter?: Partial<ILog>): Promise<LogEntity> {
        return this.logRepository.findOne(filter);
    }

    create(log: Omit<ILog, 'uuid'>): Promise<LogEntity | void> {
        return this.logRepository.create(log);
    }
    update(filter: Partial<ILog>, data: Partial<ILog>): Promise<LogEntity> {
        return this.logRepository.update(filter, data);
    }
    delete(uuid: string): Promise<void> {
        return this.logRepository.delete(uuid);
    }
    findById(uuid: string): Promise<LogEntity> {
        return this.logRepository.findById(uuid);
    }
    find(filter?: Partial<ILog>): Promise<LogEntity[]> {
        return this.logRepository.find(filter);
    }
    getNativeCollection() {
        return this.logRepository.getNativeCollection();
    }

    register(log: Omit<ILog, 'uuid'>): Promise<LogEntity | void> {
        return this.create({ ...log });
    }
}
