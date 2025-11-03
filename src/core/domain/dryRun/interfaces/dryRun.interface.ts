import { SeverityLevel } from '@/shared/utils/enums/severityLevel.enum';
import { IPullRequestMessages } from '../../pullRequestMessages/interfaces/pullRequestMessages.interface';
import { IPullRequests } from '../../pullRequests/interfaces/pullRequests.interface';
import { CodeReviewParameter } from '@/config/types/general/codeReviewConfig.type';

export interface IDryRun {
    uuid: string;
    createdAt: Date;
    updatedAt: Date;

    organizationId: string;
    teamId: string;

    runs: IDryRunData[];
}

export interface IDryRunData {
    hash: string; // Full config hash
    dependents: IDryRunData['hash'][]; // Hashes of dry runs that reference this one
    createdAt: Date;
    updatedAt: Date;

    provider: IPullRequests['provider'];
    prNumber: number;
    repositoryId: string;
    directoryId?: string;

    description: string;
    messages: IDryRunMessage[];
    files: Partial<IPullRequests['files'][number]>[] | IDryRunData['hash']; // Changed files or reference to another dry run
    prLevelSuggestions:
        | Partial<IPullRequests['prLevelSuggestions'][number]>[]
        | IDryRunData['hash']; // PR level suggestions or reference to another dry run

    config: string; // ID of the code review config used
    // pullRequestMessages: string; // ID of the pull request messages used

    configHashes: {
        basic: string; // Hash of configs that do not affect LLM behavior
        llm: string; // Hash of configs that affect LLM behavior
    };
}

export interface IDryRunMessage {
    id: number;
    content: string;
    file?: string;
    lines?: {
        start: number;
        end: number;
    };
    severity?: string;
    category?: string;
    codeBlock?: string;
}
