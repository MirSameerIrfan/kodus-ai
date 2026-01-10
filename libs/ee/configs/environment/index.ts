/**
 * @license
 * Kodus Tech. All rights reserved.
 *
 * Hardcoded environment loader:
 * Values are baked into the bundle at build time via environment.ts
 *
 * NOTE: The environment.ts file is generated/modified by the Dockerfile
 * using 'sed' before the compilation step (yarn build:apps).
 */
import { environment } from './environment.dev';

export { environment };
