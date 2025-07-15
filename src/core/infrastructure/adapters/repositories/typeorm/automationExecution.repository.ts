import { IAutomationExecutionRepository } from '@/core/domain/automation/contracts/automation-execution.repository';
import { AutomationExecutionEntity } from '@/core/domain/automation/entities/automation-execution.entity';
import { IAutomationExecution } from '@/core/domain/automation/interfaces/automation-execution.interface';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AutomationExecutionModel } from './schema/automationExecution.model';
import {
    FindManyOptions,
    FindOneOptions,
    Repository,
    UpdateQueryBuilder,
} from 'typeorm';
import {
    mapSimpleModelToEntity,
    mapSimpleModelsToEntities,
} from '@/shared/infrastructure/repositories/mappers';

@Injectable()
export class AutomationExecutionRepository
    implements IAutomationExecutionRepository
{
    constructor(
        @InjectRepository(AutomationExecutionModel)
        private readonly automationExecutionRepository: Repository<AutomationExecutionModel>,
    ) {}

    async create(
        automationExecution: IAutomationExecution,
    ): Promise<AutomationExecutionEntity> {
        try {
            const queryBuilder =
                this.automationExecutionRepository.createQueryBuilder(
                    'automationExecution',
                );

            const automationExecutionModel =
                this.automationExecutionRepository.create(automationExecution);

            const automationExecutionCreated = await queryBuilder
                .insert()
                .values(automationExecutionModel)
                .execute();

            if (automationExecutionCreated) {
                const findOneOptions: FindOneOptions<AutomationExecutionModel> =
                    {
                        where: {
                            uuid: automationExecutionCreated.identifiers[0]
                                .uuid,
                        },
                    };

                const selectedAutomationExecution =
                    await this.automationExecutionRepository.findOne(
                        findOneOptions,
                    );

                if (!selectedAutomationExecution) return undefined;

                return mapSimpleModelToEntity(
                    selectedAutomationExecution,
                    AutomationExecutionEntity,
                );
            }
        } catch (error) {
            console.log(error);
        }
    }

    async update(
        filter: Partial<IAutomationExecution>,
        data: Partial<IAutomationExecution>,
    ): Promise<AutomationExecutionEntity> {
        try {
            const queryBuilder: UpdateQueryBuilder<AutomationExecutionModel> =
                this.automationExecutionRepository
                    .createQueryBuilder('automationExecution')
                    .update(AutomationExecutionModel)
                    .set(data)
                    .where('uuid = :uuid', { uuid: data.uuid });

            const automationSelected = await queryBuilder.execute();

            if (automationSelected && data?.uuid) {
                const findOneOptions: FindOneOptions<AutomationExecutionModel> =
                    {
                        where: {
                            uuid: data.uuid,
                        },
                    };

                const insertedData =
                    await this.automationExecutionRepository.findOne(
                        findOneOptions,
                    );

                if (!insertedData) {
                    return null;
                }

                if (insertedData) {
                    return mapSimpleModelToEntity(
                        insertedData,
                        AutomationExecutionEntity,
                    );
                }
            }

            return null;
        } catch (error) {
            console.log(error);
        }
    }

    async delete(uuid: string): Promise<void> {
        try {
            await this.automationExecutionRepository.delete(uuid);
        } catch (error) {
            console.log(error);
        }
    }

    async findById(uuid: string): Promise<AutomationExecutionEntity> {
        try {
            const queryBuilder =
                this.automationExecutionRepository.createQueryBuilder(
                    'automationExecution',
                );

            const automationExecutionSelected = await queryBuilder
                .where('user.uuid = :uuid', { uuid })
                .getOne();

            return mapSimpleModelToEntity(
                automationExecutionSelected,
                AutomationExecutionEntity,
            );
        } catch (error) {
            console.log(error);
        }
    }

    async find(
        filter?: Partial<IAutomationExecution>,
    ): Promise<AutomationExecutionEntity[]> {
        try {
            const whereConditions: any = { ...filter };

            const findOneOptions: FindManyOptions<AutomationExecutionModel> = {
                where: whereConditions,
            };

            const automationModel =
                await this.automationExecutionRepository.find(findOneOptions);

            return mapSimpleModelsToEntities(
                automationModel,
                AutomationExecutionEntity,
            );
        } catch (error) {
            console.log(error);
        }
    }

    async findLatestExecutionByFilters(
        filters?: Partial<any>,
    ): Promise<AutomationExecutionEntity | null> {
        try {
            const queryBuilder =
                this.automationExecutionRepository.createQueryBuilder(
                    'automation_execution',
                );

            let result: AutomationExecutionModel | null =
                null;

            if (filters) {
                Object.keys(filters).forEach((key) => {
                    const value =
                        typeof filters[key] === 'object' &&
                        filters[key]?.uuid
                            ? filters[key].uuid
                            : filters[key];

                    queryBuilder.andWhere(
                        `automation_execution.${key} = :${key}`,
                        { [key]: value },
                    );
                });

                result = await queryBuilder
                    .orderBy('automation_execution.createdAt', 'DESC')
                    .getOne();
            }

            return mapSimpleModelToEntity(result, AutomationExecutionEntity);
        } catch (error) {
            console.log(error);
        }
    }

    async findByPeriodAndTeamAutomationId(
        startDate: Date,
        endDate: Date,
        teamAutomationId: string,
    ): Promise<AutomationExecutionEntity[]> {
        try {
            const queryBuilder =
                this.automationExecutionRepository.createQueryBuilder(
                    'automation_execution',
                );
            queryBuilder.where(
                'automation_execution.createdAt BETWEEN :startDate AND :endDate',
                { startDate, endDate },
            );
            queryBuilder.andWhere(
                'automation_execution.team_automation_id = :teamAutomationId',
                { teamAutomationId },
            );
            const result = await queryBuilder.getMany();
            return mapSimpleModelsToEntities(result, AutomationExecutionEntity);
        } catch (error) {
            console.log(error);
        }
    }
}
