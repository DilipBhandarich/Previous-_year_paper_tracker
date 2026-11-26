module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'index.js',
    'middleware/**/*.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};
