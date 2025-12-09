import { createLogger } from '@kodus/flow';
import { OrganizationAndTeamData } from '@libs/core/domain/types/general/organizationAndTeamData';
import {
    CODE_REVIEW_EXECUTION_REPOSITORY,
    ICodeReviewExecutionRepository,
} from '@libs/code-review/domain/executions/contracts/codeReviewExecution.repository.contract';
import { ICodeReviewExecutionService } from '@libs/code-review/domain/executions/contracts/codeReviewExecution.service.contract';
import { CodeReviewExecutionEntity } from '@libs/code-review/domain/executions/entities/codeReviewExecution.entity';
import { CodeReviewExecution } from '@libs/code-review/domain/executions/interfaces/codeReviewExecution.interface';
import { Inject, Injectable } from '@nestjs/common';

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
