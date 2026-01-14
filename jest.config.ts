import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'js', 'json'],
    testMatch: ['**/*.spec.ts', '**/*.integration.spec.ts', '**/*.e2e-spec.ts'],
    transform: {
        '^.+\\.(t|j)s$': [
            '@swc/jest',
            {
                jsc: {
                    parser: {
                        syntax: 'typescript',
                        decorators: true,
                    },
                    transform: {
                        legacyDecorator: true,
                        decoratorMetadata: true,
                    },
                },
            },
        ],
    },
    moduleNameMapper: {
        '^@/core/domain/issues/(.*)$': '<rootDir>/libs/issues/domain/$1',
        '^@/core/domain/auth/(.*)$': '<rootDir>/libs/identity/domain/auth/$1',
        '^@/core/domain/automation/(.*)$':
            '<rootDir>/libs/automation/domain/$1',
        '^@/core/domain/organization/(.*)$':
            '<rootDir>/libs/organization/domain/$1',
        '^@/core/domain/kodyRules/(.*)$': '<rootDir>/libs/kodyRules/domain/$1',
        '^@/config/(.*)$': '<rootDir>/libs/core/infrastructure/config/$1',
        '^@/shared/utils/(.*)$': '<rootDir>/libs/common/utils/$1',
        '^@libs/platform/infrastructure/services/(.*)$':
            '<rootDir>/libs/platform/infrastructure/adapters/services/$1',
        '^@/(.*)$': '<rootDir>/libs/$1',
        '^@libs/(.*)$': '<rootDir>/libs/$1',
        '^@apps/(.*)$': '<rootDir>/apps/$1/src',
        '^@kodus/kodus-common/(.*)$': '<rootDir>/packages/kodus-common/src/$1',
        '^@kodus/kodus-common$': '<rootDir>/packages/kodus-common/src',
        '^@kodus/flow/(.*)$': '<rootDir>/packages/kodus-flow/src/$1',
        '^@kodus/flow$': '<rootDir>/packages/kodus-flow/src',
    },
    transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
    modulePathIgnorePatterns: ['<rootDir>/.yalc', '<rootDir>/packages/'],
};
