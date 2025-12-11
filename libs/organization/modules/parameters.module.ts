import { Module } from '@nestjs/common';
import { ParametersController } from 'apps/api/src/controllers/parameters.controller';
import { ParametersCoreModule } from './parameters-core.module';

@Module({
    imports: [ParametersCoreModule],
    controllers: [ParametersController],
    providers: [],
    exports: [],
})
export class ParametersModule {}
