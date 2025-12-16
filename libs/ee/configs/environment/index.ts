/**
 * @license
 * Kodus Tech. All rights reserved.
 *
 * Smart environment loader:
 * - ✅ In dev, loads from environment.dev.ts
 * - ✅ In QA/Prod, loads from environment.ts (generated at build time)
 */

import { existsSync } from 'fs';
import { join } from 'path';

import { environment as devEnvironment } from './environment.dev';
import { Environment } from './types';

let environment: Environment;

const prodPath = join(__dirname, 'environment.js');

if (existsSync(prodPath)) {
    const envFile = './environment';

    environment = require(envFile).environment;
} else {
    environment = devEnvironment;
}

export { environment };
