// Mock environment variables before requiring app
process.env.JWT_SECRET = 'test_secret_key_for_testing_only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = 'test';

// Mock the pg Pool to avoid real DB connections
const mockQuery = jest.fn();
const mockConnect = jest.fn(() => Promise.resolve({
  query: mockQuery,
  release: jest.fn(),
}));
const mockEnd = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd,
    on: jest.fn(),
  })),
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test AI response' } }],
          usage: { total_tokens: 10 },
        }),
      },
    },
  }));
});

module.exports = { mockQuery, mockConnect, mockEnd };
