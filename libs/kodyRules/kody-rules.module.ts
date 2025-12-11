import { Module } from '@nestjs/common';
import { KodyRulesCoreModule } from './kody-rules-core.module';

@Module({
    imports: [KodyRulesCoreModule],
    controllers: [],
    providers: [],
    exports: [KodyRulesCoreModule],
})
export class KodyRulesModule {}
