import { Module } from '@nestjs/common';
import { OrganizationCoreModule } from './organization-core.module';
import { OrganizationController } from 'apps/api/src/controllers/organization.controller';

@Module({
    imports: [OrganizationCoreModule],
    controllers: [OrganizationController],
    providers: [],
    exports: [],
})
export class OrganizationModule {}
