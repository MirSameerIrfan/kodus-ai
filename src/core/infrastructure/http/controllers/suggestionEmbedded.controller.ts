import { Controller, Get, Query } from '@nestjs/common';
import { SuggestionEmbeddedService } from '@/core/infrastructure/adapters/services/kodyFineTuning/suggestionEmbedded/suggestionEmbedded.service';

// TODO: remove, unused
@Controller('suggestion-embedded')
export class SuggestionEmbeddedController {
    constructor(
        private readonly suggestionEmbeddedService: SuggestionEmbeddedService,
    ) {}

    // TODO: remove, unused
    @Get('/organization')
    async getSuggestionEmbeddedByOrganization(
        @Query('organizationId') organizationId: string,
    ) {
        return this.suggestionEmbeddedService.getByOrganization(organizationId);
    }

    // TODO: remove, unused
    @Get('/repository')
    async getSuggestionEmbedded(
        @Query('organizationId') organizationId: string,
        @Query('repositoryId') repositoryId: string,
    ) {
        return this.suggestionEmbeddedService.getByRepositoryAndOrganization(
            repositoryId,
            organizationId,
        );
    }

    // TODO: remove, unused
    @Get('/organization/languages')
    async getSuggestionEmbeddedByOrganizationWithLanguages(
        @Query('organizationId') organizationId: string,
    ) {
        return this.suggestionEmbeddedService.getByOrganizationWithLanguages(
            organizationId,
        );
    }

    // TODO: remove, unused
    @Get('/repository/languages')
    async getSuggestionEmbeddedByRepositoryWithLanguages(
        @Query('organizationId') organizationId: string,
        @Query('repositoryId') repositoryId: string,
    ) {
        return this.suggestionEmbeddedService.getByRepositoryAndOrganizationWithLanguages(
            repositoryId,
            organizationId,
        );
    }
}
