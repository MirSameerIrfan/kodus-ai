import { FileChange } from '@libs/common/types/general/codeReview.type';

export interface ISecurityAnalysisService {
    analyzeSecurity(file: FileChange): Promise<any>;
}
