export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'js', 'json'],
    testMatch: ['**/*.spec.ts', '**/*.integration.spec.ts', '**/*.e2e-spec.ts'],
    transform: {
        '^.+\\.(t|j)s$': [
            'ts-jest',
            { tsconfig: 'tsconfig.spec.json', diagnostics: false },
        ],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@kodus/kodus-common/(.*)$': '<rootDir>/packages/kodus-common/src/$1',
        '^@kodus/kodus-common$': '<rootDir>/packages/kodus-common/src',
        '^@kodus/flow/(.*)$': '<rootDir>/packages/kodus-flow/src/$1',
        '^@kodus/flow$': '<rootDir>/packages/kodus-flow/src',
    },
    modulePathIgnorePatterns: ['<rootDir>/.yalc'],
};
