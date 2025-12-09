import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

export class GetOrganizationIdUseCase implements IUseCase {
    constructor(
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        },
    ) {}
    public async execute(): Promise<string> {
        return this.request.user.organization.uuid;
    }
}
