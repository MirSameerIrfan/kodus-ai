import { PlatformType } from '@/shared/domain/enums/platform-type.enum';
import { GitHubReaction } from '@/core/domain/codeReviewFeedback/enums/codeReviewCommentReaction.enum';

const ACKNOWLEDGMENT_MESSAGES = {
    DEFAULT: 'Analyzing your request...',
    MARKDOWN_SUFFIX: '<!-- kody-codereview -->\n&#8203;',
} as const;

interface PlatformResponsePolicy {
    requiresAcknowledgment(): boolean;
    usesReaction(): boolean;
    getAcknowledgmentReaction?(): GitHubReaction;
    getAcknowledgmentBody?(): string;
}

class GitHubResponsePolicy implements PlatformResponsePolicy {
    requiresAcknowledgment(): boolean {
        return false;
    }

    usesReaction(): boolean {
        return true;
    }

    getAcknowledgmentReaction(): GitHubReaction {
        return GitHubReaction.ROCKET;
    }
}

class GitLabResponsePolicy implements PlatformResponsePolicy {
    requiresAcknowledgment(): boolean {
        return true;
    }

    usesReaction(): boolean {
        return false;
    }

    getAcknowledgmentBody(): string {
        return `${ACKNOWLEDGMENT_MESSAGES.DEFAULT}${ACKNOWLEDGMENT_MESSAGES.MARKDOWN_SUFFIX}`.trim();
    }
}

class BitbucketResponsePolicy implements PlatformResponsePolicy {
    requiresAcknowledgment(): boolean {
        return true;
    }

    usesReaction(): boolean {
        return false;
    }

    getAcknowledgmentBody(): string {
        return ACKNOWLEDGMENT_MESSAGES.DEFAULT.trim();
    }
}

class AzureReposResponsePolicy implements PlatformResponsePolicy {
    requiresAcknowledgment(): boolean {
        return true;
    }

    usesReaction(): boolean {
        return false;
    }

    getAcknowledgmentBody(): string {
        return `${ACKNOWLEDGMENT_MESSAGES.DEFAULT}${ACKNOWLEDGMENT_MESSAGES.MARKDOWN_SUFFIX}`.trim();
    }
}

export class PlatformResponsePolicyFactory {
    static create(platformType: PlatformType): PlatformResponsePolicy {
        switch (platformType) {
            case PlatformType.GITHUB:
                return new GitHubResponsePolicy();
            case PlatformType.GITLAB:
                return new GitLabResponsePolicy();
            case PlatformType.BITBUCKET:
                return new BitbucketResponsePolicy();
            case PlatformType.AZURE_REPOS:
                return new AzureReposResponsePolicy();
            default:
                return new GitLabResponsePolicy();
        }
    }
}

