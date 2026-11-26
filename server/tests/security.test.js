const request = require('supertest');
const { mockQuery } = require('./setup');
let app;

beforeAll(() => {
  app = require('../index');
});

describe('Security Tests', () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  describe('SQL Injection Prevention', () => {
    it('should sanitize search input in subjects', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/subjects?search=math\' OR \'1\'=\'1');
      expect(res.status).toBe(200);
      // The query should use parameterized queries, not be vulnerable
      expect(mockQuery).toHaveBeenCalled();
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1]).toContain('%math\' OR \'1\'=\'1%');
    });

    it('should sanitize search input in papers', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/papers?search=test; DROP TABLE users;--');
      expect(res.status).toBe(200);
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1]).toContain('%test; DROP TABLE users;--%');
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limit headers on auth endpoints', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@test.com', password: 'wrong'
      });
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    it('should have CORS headers', async () => {
      const res = await request(app).options('/api/health');
      expect(res.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should have security headers from helmet', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('Auth Bypass Prevention', () => {
    it('should reject requests to protected endpoints without token', async () => {
      const res = await request(app).post('/api/subjects').send({ name: 'Test' });
      expect(res.status).toBe(401);
    });

    it('should reject requests with malformed token', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', 'InvalidToken')
        .send({ name: 'Test' });
      expect(res.status).toBe(401);
    });

    it('should reject requests with empty token', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', 'Bearer ')
        .send({ name: 'Test' });
      expect(res.status).toBe(401);
    });
  });

  describe('Authorization - Ownership', () => {
    it('should prevent deleting others subjects', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ id: 2, email: 'other@test.com', role: 'student' }, process.env.JWT_SECRET);
      mockQuery.mockResolvedValueOnce({ rows: [{ created_by: 1 }] });
      const res = await request(app)
        .delete('/api/subjects/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('only delete subjects you created');
    });

    it('should prevent deleting others papers', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ id: 2, email: 'other@test.com', role: 'student' }, process.env.JWT_SECRET);
      mockQuery.mockResolvedValueOnce({ rows: [{ created_by: 1 }] });
      const res = await request(app)
        .delete('/api/papers/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('only delete papers you created');
    });

    it('should prevent deleting others notes', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ id: 2, email: 'other@test.com', role: 'student' }, process.env.JWT_SECRET);
      mockQuery.mockResolvedValueOnce({ rows: [{ created_by: 1 }] });
      const res = await request(app)
        .delete('/api/notes/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('only delete notes you created');
    });
  });

  describe('Input Validation', () => {
    it('should reject oversized JSON', async () => {
      const hugeContent = 'x'.repeat(11 * 1024 * 1024);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: hugeContent, password: hugeContent });
      expect(res.status).toBe(413);
    });
  });
});
