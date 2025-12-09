import { IDryRunRepository } from '@libs/dryRun/domain/contracts/dryRun.repository.contract';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DryRunModel } from './schemas/dryRun.model';
import { Model } from 'mongoose';
import { IDryRun } from '@libs/dryRun/domain/interfaces/dryRun.interface';
import {
    mapSimpleModelsToEntities,
    mapSimpleModelToEntity,
} from '@libs/core/infrastructure/repositories/mappers';
import { DryRunEntity } from '@libs/dryRun/domain/entities/dryRun.entity';

@Injectable()
export class DryRunRepository implements IDryRunRepository {
    constructor(
        @InjectModel(DryRunModel.name)
        private readonly dryRunModel: Model<DryRunModel>,
    ) {}

    async create(
        dryRun: Omit<IDryRun, 'uuid' | 'createdAt' | 'updatedAt'>,
    ): Promise<DryRunEntity> {
        const createdDryRun = await this.dryRunModel.create(dryRun);
        return mapSimpleModelToEntity(createdDryRun, DryRunEntity);
    }

    async update(
        uuid: string,
        dryRun: Partial<IDryRun>,
    ): Promise<DryRunEntity> {
        const updatedDryRun = await this.dryRunModel
            .findByIdAndUpdate(uuid, dryRun, { new: true })
            .exec();

        if (!updatedDryRun) {
            throw new Error('DryRun not found');
        }

        return mapSimpleModelToEntity(updatedDryRun, DryRunEntity);
    }

    async findOne(filter: Partial<IDryRun>): Promise<DryRunEntity | null> {
        const dryRun = await this.dryRunModel.findOne(filter).exec();
        if (!dryRun) {
            return null;
        }
        return mapSimpleModelToEntity(dryRun, DryRunEntity);
    }

    async find(filter: Partial<IDryRun>): Promise<DryRunEntity[]> {
        const dryRuns = await this.dryRunModel.find(filter).exec();
        return mapSimpleModelsToEntities(dryRuns, DryRunEntity);
    }

    async delete(uuid: string): Promise<void> {
        await this.dryRunModel.deleteOne({ _id: uuid }).exec();
    }
}
