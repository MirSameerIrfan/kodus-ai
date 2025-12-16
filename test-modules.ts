import 'source-map-support/register';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.API_RABBITMQ_ENABLED = 'true';

import { Test } from '@nestjs/testing';
import { RabbitMQWrapperModule } from './libs/core/infrastructure/queue/rabbitmq.module';
import { PlatformModule } from './libs/platform/modules/platform.module';
import { CodebaseModule } from './libs/code-review/modules/codebase.module';
import { WorkflowModule } from './libs/core/workflow/workflow.module';
import { SharedConfigModule } from './libs/shared/infrastructure/shared-config.module';
import { SharedLogModule } from './libs/shared/infrastructure/shared-log.module';
import { KodusLoggerService } from './libs/core/log/kodus-logger.service';

// Timeout promise helper
const timeout = (ms: number, name: string) =>
    new Promise((_, reject) =>
        setTimeout(
            () => reject(new Error(`${name} TIMED OUT after ${ms}ms`)),
            ms,
        ),
    );

async function testModule(name: string, moduleClass: any, imports: any[] = []) {
    console.log(`\n--- Testing ${name} ---`);
    try {
        const builder = Test.createTestingModule({
            imports: [
                SharedConfigModule,
                SharedLogModule,
                ...imports,
                moduleClass,
            ],
        });

        // Use logger to see initialization logs
        builder.setLogger(new KodusLoggerService());

        console.log(`[${name}] Creating module...`);
        const moduleRef = await Promise.race([
            builder.compile(),
            timeout(10000, `${name} Compilation`),
        ]);
        console.log(`[${name}] Module compiled.`);

        console.log(`[${name}] Initializing...`);
        const app = moduleRef.createNestApplication();
        await Promise.race([
            app.init(),
            timeout(10000, `${name} Initialization`),
        ]);

        console.log(`✅ [${name}] SUCCESS!`);
        await app.close();
    } catch (error) {
        console.error(`❌ [${name}] FAILED:`, error.message);
    }
}

async function run() {
    console.log('Starting Diagnostic Tests...');

    // 1. Test RabbitMQWrapperModule (Infrastructure)
    // We need to pass options if it's dynamic, but let's try the static class or register
    await testModule(
        'RabbitMQWrapperModule',
        RabbitMQWrapperModule.register({ enableConsumers: false }),
    );

    // 2. Test PlatformModule (Domain Base)
    await testModule('PlatformModule', PlatformModule);

    // 3. Test CodebaseModule (Domain Dependent)
    // This one likely depends on PlatformModule
    await testModule('CodebaseModule', CodebaseModule);

    // 4. Test WorkflowModule (Orchestration - The big one)
    await testModule(
        'WorkflowModule',
        WorkflowModule.register({ type: 'worker' }),
    );

    console.log('\n--- Diagnostic Complete ---');
    process.exit(0);
}

run();
