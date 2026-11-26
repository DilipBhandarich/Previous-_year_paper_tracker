const request = require('supertest');
const { mockQuery } = require('./setup');
let app;

beforeAll(() => {
  app = require('../index');
});

describe('API Endpoints', () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
    });

    it('should handle database failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
    });
  });

  describe('GET /api/subjects', () => {
    it('should return subjects list', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Math', code: 'MATH101', semester: 1, branch: 'Common', paper_count: '5' },
          { id: 2, name: 'Physics', code: 'PHY101', semester: 1, branch: 'Common', paper_count: '3' }
        ]
      });
      const res = await request(app).get('/api/subjects');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('should support pagination', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/subjects?limit=10&offset=0');
      expect(res.status).toBe(200);
    });

    it('should support search filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/subjects?search=math');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/subjects', () => {
    it('should reject without auth', async () => {
      const res = await request(app).post('/api/subjects').send({ name: 'New Subject' });
      expect(res.status).toBe(401);
    });

    it('should create subject with auth', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'student' }, process.env.JWT_SECRET);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'New Subject', code: 'NS101', semester: 1, branch: 'CSE', created_by: 1 }]
      });
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Subject', code: 'NS101', semester: 1, branch: 'CSE' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Subject');
    });
  });

  describe('GET /api/papers', () => {
    it('should return papers list', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, subject_id: 1, year: 2023, exam_type: 'IAT-1', title: 'Test Paper', subject_name: 'Math' }
        ]
      });
      const res = await request(app).get('/api/papers');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should support filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/papers?year=2023&exam_type=IAT-1&branch=CSE');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/notes', () => {
    it('should return notes list', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Test Note', content: 'Content', color: 'blue', subject_name: 'Math' }
        ]
      });
      const res = await request(app).get('/api/notes');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/stats', () => {
    it('should return statistics', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '15' }] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [{ count: '4' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ count: '25' }] });
      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(200);
      expect(res.body.totalSubjects).toBe(15);
      expect(res.body.totalPapers).toBe(100);
      expect(res.body.totalUsers).toBe(50);
      expect(res.body.totalNotes).toBe(25);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown endpoints', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Endpoint not found');
    });
  });
});
