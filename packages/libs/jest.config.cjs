/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@telegenie/libs/(.*)$': '<rootDir>/src/$1',
    '^@telegenie/decorators$': '<rootDir>/../decorators/src/index.ts',
    '^@telegenie/agent/worker/create-default-agent-worker$': '<rootDir>/../agent/src/worker/create-default-agent-worker.ts',
    '^@telegenie/agent/worker$': '<rootDir>/../agent/src/worker/index.ts',
    '^@telegenie/agent/(.*)$': '<rootDir>/../agent/src/$1',
    '^@telegenie/agent$': '<rootDir>/../agent/src/index.ts',
    '^@telegenie/teleproto/client/(.*)$': '<rootDir>/../teleproto/dist/client/$1.js',
    '^@telegenie/teleproto/Utils$': '<rootDir>/../teleproto/dist/Utils.js',
    '^@telegenie/teleproto/events$': '<rootDir>/../teleproto/dist/events/index.js',
    '^@telegenie/teleproto/sessions$': '<rootDir>/../teleproto/dist/sessions/index.js',
    '^@telegenie/teleproto/client/telegramBaseClient$':
      '<rootDir>/../teleproto/dist/client/telegramBaseClient.js',
    '^@telegenie/teleproto$': '<rootDir>/../teleproto/dist/index.js',
    '^lodash-es$': '<rootDir>/test-shims/lodash-es.cjs',
    '^lodash-es/(.*)$': '<rootDir>/test-shims/lodash-es.cjs',
  },
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/test-harness.ts',
    '!src/**/index.ts',
    '!src/**/types.ts',
    '!src/**/*.d.ts',
    '!src/foundation/telegram/types/**',
    '!src/foundation/telegram/services/base.service.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
};
