module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    'src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
