export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.spec.ts', '**/*.integration.spec.ts', '**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json', diagnostics: false }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@context-os-core/(.*)$': '<rootDir>/src/shared/utils/context-os-core/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/.yalc'],
};
