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

import { Environment } from './types';

let environment: Environment;

// Caminhos absolutos relativos ao arquivo atual
const prodPath = join(__dirname, 'environment.js'); // esse é gerado no build

if (existsSync(prodPath)) {
    // 🟢 Docker QA/Prod: injetado no build
    const envFile = './environment';

    environment = require(envFile).environment;
} else {
    // 🛠️ Dev: valor dinâmico via process.env

    environment = require('./environment.dev').environment;
}

export { environment };
