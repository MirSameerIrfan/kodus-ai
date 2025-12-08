import { FileChange } from '@shared/types/general/codeReview.type';

export interface ISecurityAnalysisService {
    analyzeSecurity(file: FileChange): Promise<any>;
}
