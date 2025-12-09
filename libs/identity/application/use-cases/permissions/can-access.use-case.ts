import { createLogger } from '@kodus/flow';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';
import { PermissionsAbilityFactory } from '@libs/identity/infrastructure/adapters/services/permissions/permissionsAbility.factory';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CanAccessUseCase implements IUseCase {
    private readonly logger = createLogger(CanAccessUseCase.name);
    constructor(private readonly abilityFactory: PermissionsAbilityFactory) {}

    async execute(params: {
        user: Partial<IUser>;
        action: Action;
        resource: ResourceType;
    }): Promise<boolean> {
        const { user, action, resource } = params;

        if (
            !user ||
            !user.uuid ||
            !user.organization?.uuid ||
            !action ||
            !resource
        ) {
            this.logger.warn({
                message: 'Missing parameters in can-access use case',
                metadata: { params },
                context: CanAccessUseCase.name,
            });
            return false;
        }

        try {
            const ability = await this.abilityFactory.createForUser(
                user as IUser,
            );

            return ability.can(action, resource);
        } catch (error) {
            this.logger.error({
                message: 'Error checking access permissions',
                error,
                metadata: { params },
                context: CanAccessUseCase.name,
            });
            return false;
        }
    }
}
