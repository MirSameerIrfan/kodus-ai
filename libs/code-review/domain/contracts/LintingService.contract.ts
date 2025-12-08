import { FileChange } from '@shared/types/general/codeReview.type';

export const LINTING_SERVICE_TOKEN = Symbol('LintingService');
export interface ILintingService {
    lintCode(file: FileChange): Promise<any>;
}
