const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode') ? undefined : false
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        semester INTEGER,
        branch VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS papers (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        exam_type VARCHAR(50) DEFAULT 'Annual',
        description TEXT,
        file_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const { rows } = await client.query('SELECT COUNT(*) FROM subjects');
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO subjects (name, code, semester, branch) VALUES
        ('Engineering Mathematics I', 'MATH101', 1, 'Common'),
        ('Engineering Physics', 'PHY101', 1, 'Common'),
        ('Engineering Chemistry', 'CHEM101', 1, 'Common'),
        ('Computer Science Fundamentals', 'CS101', 2, 'CSE'),
        ('Data Structures', 'CS201', 3, 'CSE'),
        ('Database Management Systems', 'CS301', 4, 'CSE'),
        ('Operating Systems', 'CS401', 5, 'CSE'),
        ('Computer Networks', 'CS402', 5, 'CSE'),
        ('Software Engineering', 'CS501', 6, 'CSE'),
        ('Compiler Design', 'CS502', 6, 'CSE')
      `);

      const { rows: subjects } = await client.query('SELECT id FROM subjects LIMIT 3');
      for (const subject of subjects) {
        for (const year of [2021, 2022, 2023]) {
          await client.query(`
            INSERT INTO papers (subject_id, year, exam_type, description)
            VALUES ($1, $2, $3, $4)
          `, [subject.id, year, 'Annual', `${year} Annual Examination Paper`]);
        }
      }
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('DB init error:', err.message);
  } finally {
    client.release();
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'NCET Paper Tracker API is running' });
});

app.get('/api/subjects', async (req, res) => {
  try {
    const { semester, branch } = req.query;
    let query = 'SELECT * FROM subjects';
    const params = [];
    const conditions = [];

    if (semester) {
      params.push(parseInt(semester));
      conditions.push(`semester = $${params.length}`);
    }
    if (branch) {
      params.push(branch);
      conditions.push(`branch = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY semester, name';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subjects/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const { name, code, semester, branch } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name is required' });
    const { rows } = await pool.query(
      'INSERT INTO subjects (name, code, semester, branch) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, code, semester, branch]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/papers', async (req, res) => {
  try {
    const { subject_id, year, exam_type } = req.query;
    let query = `
      SELECT p.*, s.name as subject_name, s.code as subject_code, s.semester, s.branch
      FROM papers p
      JOIN subjects s ON p.subject_id = s.id
    `;
    const params = [];
    const conditions = [];

    if (subject_id) {
      params.push(parseInt(subject_id));
      conditions.push(`p.subject_id = $${params.length}`);
    }
    if (year) {
      params.push(parseInt(year));
      conditions.push(`p.year = $${params.length}`);
    }
    if (exam_type) {
      params.push(exam_type);
      conditions.push(`p.exam_type = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY p.year DESC, s.name';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/papers/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, s.name as subject_name, s.code as subject_code, s.semester, s.branch
      FROM papers p
      JOIN subjects s ON p.subject_id = s.id
      WHERE p.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Paper not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/papers', async (req, res) => {
  try {
    const { subject_id, year, exam_type, description, file_url } = req.body;
    if (!subject_id || !year) return res.status(400).json({ error: 'subject_id and year are required' });
    const { rows } = await pool.query(
      'INSERT INTO papers (subject_id, year, exam_type, description, file_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [subject_id, year, exam_type || 'Annual', description, file_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/papers/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM papers WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Paper not found' });
    res.json({ message: 'Paper deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [subjects, papers, years] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM subjects'),
      pool.query('SELECT COUNT(*) FROM papers'),
      pool.query('SELECT COUNT(DISTINCT year) FROM papers')
    ]);
    res.json({
      totalSubjects: parseInt(subjects.rows[0].count),
      totalPapers: parseInt(papers.rows[0].count),
      totalYears: parseInt(years.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initDb().then(() => {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
