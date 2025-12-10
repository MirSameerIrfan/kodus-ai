import { ISuggestionToEmbed } from '@libs/code-review/domain/pull-requests/interfaces/pullRequests.interface';
import {
    SuggestionEmbeddedFeedbacks,
    SuggestionEmbeddedFeedbacksWithLanguage,
} from '@libs/code-review/ee/fine-tuning/infrastructure/suggestionEmbedded/suggestionEmbedded.service';
import { CodeSuggestion } from '@libs/core/infrastructure/config/types/general/codeReview.type';

import { ISuggestionEmbeddedRepository } from './suggestionEmbedded.repository.contract';
import { SuggestionEmbeddedEntity } from '../entities/suggestionEmbedded.entity';


export const SUGGESTION_EMBEDDED_SERVICE_TOKEN = Symbol(
    'SuggestionEmbeddedService',
);

export interface ISuggestionEmbeddedService extends ISuggestionEmbeddedRepository {
    bulkCreateFromMongoData(
        suggestions: ISuggestionToEmbed[],
    ): Promise<SuggestionEmbeddedEntity[] | undefined>;

    findByLanguage(language: string): Promise<SuggestionEmbeddedEntity[]>;

    findByFeedbackType(
        feedbackType: string,
    ): Promise<SuggestionEmbeddedEntity[]>;

    getByOrganization(
        organizationId: string,
    ): Promise<SuggestionEmbeddedFeedbacks>;

    getByRepositoryAndOrganization(
        repositoryId: string,
        organizationId: string,
    ): Promise<SuggestionEmbeddedFeedbacks>;

    getByOrganizationWithLanguages(
        organizationId: string,
    ): Promise<SuggestionEmbeddedFeedbacksWithLanguage>;

    getByRepositoryAndOrganizationWithLanguages(
        repositoryId: string,
        organizationId: string,
    ): Promise<SuggestionEmbeddedFeedbacksWithLanguage>;

    embedSuggestionsForISuggestionToEmbed(
        codeSuggestions: Partial<CodeSuggestion>[],
        organizationId: string,
        prNumber: number,
        repositoryId: string,
        repositoryFullName: string,
    ): Promise<ISuggestionToEmbed[]>;
}
