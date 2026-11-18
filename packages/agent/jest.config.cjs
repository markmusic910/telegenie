/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/evals'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@telegenie/agent/(.*)$': '<rootDir>/src/$1',
    '^@telegenie/agent$': '<rootDir>/src/index.ts',
    '^@telegenie/libs/(.*)$': '<rootDir>/../libs/src/$1',
    '^@telegenie/config/(.*)$': '<rootDir>/../config/src/$1',
    '^@telegenie/config$': '<rootDir>/../config/src/index.ts',
    '^@telegenie/decorators$': '<rootDir>/../decorators/src/index.ts',
    '^lodash-es$': '<rootDir>/../sdk/test-shims/lodash-es.cjs',
    '^lodash-es/(.*)$': '<rootDir>/../sdk/test-shims/lodash-es.cjs',
    '^@grafeo-db/web$': '<rootDir>/../../node_modules/@grafeo-db/web/dist/index.cjs',
    '^@grafeo-db/wasm$': '<rootDir>/test-shims/grafeo-wasm.cjs',
    '^uuid$': '<rootDir>/test-shims/uuid.cjs',
  },
  transformIgnorePatterns: ['/node_modules/(?!(@telegenie|uuid)/)'],
};

