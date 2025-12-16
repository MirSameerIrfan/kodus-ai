import { ICodeReviewExecutionRepository } from './codeReviewExecution.repository.contract';

export const CODE_REVIEW_EXECUTION_SERVICE = Symbol(
    'CODE_REVIEW_EXECUTION_SERVICE',
);

export type ICodeReviewExecutionService<T> = ICodeReviewExecutionRepository<T>;
