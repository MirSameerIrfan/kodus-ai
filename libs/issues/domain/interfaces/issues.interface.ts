import { IssueStatus } from '@libs/core/infrastructure/config/types/general/issues.type';
import { LabelType } from '@libs/core/utils/codeManagement/labels';
import { SeverityLevel } from '@libs/core/utils/enums/severityLevel.enum';
import {
    IContributingSuggestion,
    IRepositoryToIssues,
} from '@libs/issues/domain/interfaces/kodyIssuesManagement.interface';

export interface IIssue {
    uuid?: string;
    title: string;
    description: string;
    filePath: string;
    language: string;
    label: LabelType;
    severity: SeverityLevel;
    contributingSuggestions: IContributingSuggestion[];
    repository: IRepositoryToIssues;
    organizationId: string;
    age?: string;
    status?: IssueStatus;
    createdAt: string;
    updatedAt: string;
    prNumbers?: string[];
    owner?: {
        gitId: string;
        username: string;
    };
    reporter?: {
        gitId: string;
        username: string;
    };
}
