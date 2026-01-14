import { createLogger } from '@kodus/flow';
import { Inject, Injectable } from '@nestjs/common';

import {
    CODE_REVIEW_EXECUTION_REPOSITORY,
    ICodeReviewExecutionRepository,
} from '@libs/automation/domain/codeReviewExecutions/contracts/codeReviewExecution.repository.contract';
import { ICodeReviewExecutionService } from '@libs/automation/domain/codeReviewExecutions/contracts/codeReviewExecution.service.contract';
import { CodeReviewExecutionEntity } from '@libs/automation/domain/codeReviewExecutions/entities/codeReviewExecution.entity';
import { CodeReviewExecution } from '@libs/automation/domain/codeReviewExecutions/interfaces/codeReviewExecution.interface';

@Injectable()
export class CodeReviewExecutionService<
    T,
> implements ICodeReviewExecutionService<T> {
    private readonly logger = createLogger(CodeReviewExecutionService.name);
    constructor(
        @Inject(CODE_REVIEW_EXECUTION_REPOSITORY)
        private readonly codeReviewExecutionRepository: ICodeReviewExecutionRepository<T>,
    ) {}

    create(
        codeReviewExecution: Omit<
            CodeReviewExecution<T>,
            'uuid' | 'createdAt' | 'updatedAt'
        >,
    ): Promise<CodeReviewExecutionEntity<T> | null> {
        return this.codeReviewExecutionRepository.create(codeReviewExecution);
    }

    update(
        filter: Partial<CodeReviewExecution<T>>,
        codeReviewExecution: Partial<
            Omit<CodeReviewExecution<T>, 'uuid' | 'createdAt' | 'updatedAt'>
        >,
    ): Promise<CodeReviewExecutionEntity<T> | null> {
        return this.codeReviewExecutionRepository.update(
            filter,
            codeReviewExecution,
        );
    }

    find(
        filter?: Partial<CodeReviewExecution<T>>,
    ): Promise<CodeReviewExecutionEntity<T>[]> {
        return this.codeReviewExecutionRepository.find(filter);
    }

    findOne(
        filter?: Partial<CodeReviewExecution<T>>,
    ): Promise<CodeReviewExecutionEntity<T> | null> {
        return this.codeReviewExecutionRepository.findOne(filter);
    }

    findManyByAutomationExecutionIds(
        uuids: string[],
    ): Promise<CodeReviewExecutionEntity<T>[]> {
        return this.codeReviewExecutionRepository.findManyByAutomationExecutionIds(
            uuids,
        );
    }

    delete(uuid: string): Promise<boolean> {
        return this.codeReviewExecutionRepository.delete(uuid);
    }
}
