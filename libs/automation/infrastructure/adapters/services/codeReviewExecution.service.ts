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
export class CodeReviewExecutionService implements ICodeReviewExecutionService {
    private readonly logger = createLogger(CodeReviewExecutionService.name);
    constructor(
        @Inject(CODE_REVIEW_EXECUTION_REPOSITORY)
        private readonly codeReviewExecutionRepository: ICodeReviewExecutionRepository,
    ) {}

    create(
        codeReviewExecution: Omit<
            CodeReviewExecution,
            'uuid' | 'createdAt' | 'updatedAt'
        >,
    ): Promise<CodeReviewExecutionEntity | null> {
        return this.codeReviewExecutionRepository.create(codeReviewExecution);
    }

    update(
        filter: Partial<CodeReviewExecution>,
        codeReviewExecution: Partial<
            Omit<CodeReviewExecution, 'uuid' | 'createdAt' | 'updatedAt'>
        >,
    ): Promise<CodeReviewExecutionEntity | null> {
        return this.codeReviewExecutionRepository.update(
            filter,
            codeReviewExecution,
        );
    }

    find(
        filter?: Partial<CodeReviewExecution>,
    ): Promise<CodeReviewExecutionEntity[]> {
        return this.codeReviewExecutionRepository.find(filter);
    }

    findOne(
        filter?: Partial<CodeReviewExecution>,
    ): Promise<CodeReviewExecutionEntity | null> {
        return this.codeReviewExecutionRepository.findOne(filter);
    }

    delete(uuid: string): Promise<boolean> {
        return this.codeReviewExecutionRepository.delete(uuid);
    }
}
