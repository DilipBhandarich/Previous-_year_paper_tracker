const request = require('supertest');
const { mockQuery } = require('./setup');
let app;

beforeAll(() => {
  app = require('../index');
});

afterAll(async () => {
  const { mockEnd } = require('./setup');
  await mockEnd();
});

describe('Auth Endpoints', () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  describe('POST /api/auth/register/request-otp', () => {
    it('should reject missing fields', async () => {
      const res = await request(app).post('/api/auth/register/request-otp').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('All fields required');
    });

    it('should reject invalid email', async () => {
      const res = await request(app).post('/api/auth/register/request-otp').send({
        name: 'Test', email: 'invalid', password: 'password123'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Valid email required');
    });

    it('should reject short password', async () => {
      const res = await request(app).post('/api/auth/register/request-otp').send({
        name: 'Test', email: 'test@example.com', password: '123'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must be at least 6 characters');
    });

    it('should reject already registered email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/auth/register/request-otp').send({
        name: 'Test', email: 'test@example.com', password: 'password123'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email already registered');
    });

    it('should send OTP successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/auth/register/request-otp').send({
        name: 'Test', email: 'test@example.com', password: 'password123'
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('OTP sent to email');
      expect(res.body.expiresInSeconds).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('All fields required');
    });

    it('should reject invalid credentials', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com', password: 'wrongpassword'
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject unverified email', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'test@example.com', password: 'hashed', email_verified: false }]
      });
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com', password: 'password123'
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Please verify your email first.');
    });

    it('should login successfully with valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1, name: 'Test User', email: 'test@example.com',
          password: hashedPassword, email_verified: true,
          role: 'student', avatar: 'blue', created_at: new Date()
        }]
      });
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com', password: 'password123'
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(401);
    });

    it('should return user with valid token', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ id: 1, email: 'test@example.com', role: 'student' }, process.env.JWT_SECRET);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test', email: 'test@example.com', role: 'student', avatar: 'blue', created_at: new Date() }]
      });
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@example.com');
    });
  });
});
