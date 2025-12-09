import { FileChange } from '@libs/core/domain/types/general/codeReview.type';

export interface ISecurityAnalysisService {
    analyzeSecurity(file: FileChange): Promise<any>;
}
