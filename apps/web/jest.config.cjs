/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@/lib/utils$': '<rootDir>/src/lib/utils/tw.ts',
    '^@/components/ui/(.*)$': '<rootDir>/src/lib/components/ui/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
