const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ncet_super_secret_key_2024';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype === 'application/pdf';
    cb(null, ext && mime);
  }
});

const auth = require('./middleware/auth');

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'student',
        avatar VARCHAR(50) DEFAULT 'blue',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        semester INTEGER,
        branch VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS papers (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        title VARCHAR(500),
        year INTEGER NOT NULL,
        exam_type VARCHAR(50) DEFAULT 'Annual',
        description TEXT,
        file_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS paper_files (
        id SERIAL PRIMARY KEY,
        paper_id INTEGER REFERENCES papers(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        file_type VARCHAR(50),
        file_size BIGINT,
        file_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        title VARCHAR(500),
        content TEXT NOT NULL,
        color VARCHAR(50) DEFAULT 'default',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_chats (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255),
        subject_id INTEGER,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const { rows } = await client.query('SELECT COUNT(*) FROM subjects');
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO subjects (name, code, semester, branch, description) VALUES
        ('Engineering Mathematics I', 'MATH101', 1, 'Common', 'Calculus, Linear Algebra, Differential Equations'),
        ('Engineering Physics', 'PHY101', 1, 'Common', 'Mechanics, Optics, Thermodynamics, Modern Physics'),
        ('Engineering Chemistry', 'CHEM101', 1, 'Common', 'Organic, Inorganic and Physical Chemistry'),
        ('Computer Science Fundamentals', 'CS101', 2, 'CSE', 'Introduction to Programming, Problem Solving'),
        ('Data Structures', 'CS201', 3, 'CSE', 'Arrays, Linked Lists, Trees, Graphs, Sorting Algorithms'),
        ('Database Management Systems', 'CS301', 4, 'CSE', 'SQL, Normalization, ER Diagrams, Transactions'),
        ('Operating Systems', 'CS401', 5, 'CSE', 'Process Management, Memory Management, File Systems'),
        ('Computer Networks', 'CS402', 5, 'CSE', 'TCP/IP, OSI Model, Network Protocols, Security'),
        ('Software Engineering', 'CS501', 6, 'CSE', 'SDLC, Agile, Testing, Project Management'),
        ('Compiler Design', 'CS502', 6, 'CSE', 'Lexical Analysis, Parsing, Code Generation'),
        ('Cloud Computing', 'CS601', 7, 'CSE', 'Cloud Models, Virtualization, AWS, Azure'),
        ('Machine Learning', 'CS602', 7, 'CSE', 'Supervised Learning, Neural Networks, Deep Learning'),
        ('Circuit Theory', 'ECE101', 2, 'ECE', 'Kirchhoff Laws, AC/DC Circuits, Network Analysis'),
        ('Digital Electronics', 'ECE201', 3, 'ECE', 'Logic Gates, Flip-Flops, Counters, Registers'),
        ('Thermodynamics', 'ME101', 2, 'ME', 'Laws of Thermodynamics, Cycles, Heat Transfer')
      `);
      const { rows: subs } = await client.query('SELECT id FROM subjects LIMIT 5');
      for (const s of subs) {
        for (const year of [2021, 2022, 2023, 2024]) {
          for (const exam of ['IUT-1', 'IUT-2', 'ESE']) {
            await client.query(
              'INSERT INTO papers (subject_id, year, exam_type, title, description) VALUES ($1,$2,$3,$4,$5)',
              [s.id, year, exam, `${year} ${exam} Examination`, `${year} ${exam} Question Paper`]
            );
          }
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

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password) VALUES ($1,$2,$3) RETURNING id,name,email,role,avatar,created_at',
      [name, email, hash]
    );
    const token = jwt.sign({ id: rows[0].id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields required' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const user = { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role, avatar: rows[0].avatar, created_at: rows[0].created_at };
    const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,name,email,role,avatar,created_at FROM users WHERE id=$1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────
app.get('/api/subjects', async (req, res) => {
  try {
    const { semester, branch, search, sort = 'semester' } = req.query;
    let q = 'SELECT s.*, COUNT(DISTINCT p.id) as paper_count FROM subjects s LEFT JOIN papers p ON p.subject_id=s.id';
    const params = [], conds = [];
    if (semester) { params.push(parseInt(semester)); conds.push(`s.semester=$${params.length}`); }
    if (branch) { params.push(branch); conds.push(`s.branch=$${params.length}`); }
    if (search) { params.push(`%${search}%`); conds.push(`(s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`); }
    if (conds.length) q += ' WHERE ' + conds.join(' AND ');
    q += ' GROUP BY s.id';
    const sortMap = { semester: 's.semester, s.name', name: 's.name', branch: 's.branch, s.semester', papers: 'paper_count DESC' };
    q += ` ORDER BY ${sortMap[sort] || 's.semester, s.name'}`;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/subjects/:id', async (req, res) => {
  try {
    const { rows: sub } = await pool.query('SELECT * FROM subjects WHERE id=$1', [req.params.id]);
    if (!sub.length) return res.status(404).json({ error: 'Not found' });
    const { rows: papers } = await pool.query(`
      SELECT p.*, array_agg(json_build_object('id',pf.id,'url',pf.file_url,'name',pf.original_name,'type',pf.file_type,'size',pf.file_size)) FILTER (WHERE pf.id IS NOT NULL) as files
      FROM papers p LEFT JOIN paper_files pf ON pf.paper_id=p.id
      WHERE p.subject_id=$1 GROUP BY p.id ORDER BY p.year DESC, p.exam_type
    `, [req.params.id]);
    res.json({ ...sub[0], papers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subjects', auth, async (req, res) => {
  try {
    const { name, code, semester, branch, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { rows } = await pool.query(
      'INSERT INTO subjects (name,code,semester,branch,description) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, code, semester, branch, description]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/subjects/:id', auth, async (req, res) => {
  try {
    const { name, code, semester, branch, description } = req.body;
    const { rows } = await pool.query(
      'UPDATE subjects SET name=$1,code=$2,semester=$3,branch=$4,description=$5 WHERE id=$6 RETURNING *',
      [name, code, semester, branch, description, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/subjects/:id', auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM subjects WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PAPERS ───────────────────────────────────────────────────────────────────
app.get('/api/papers', async (req, res) => {
  try {
    const { subject_id, year, exam_type, branch, semester, search } = req.query;
    let q = `
      SELECT p.*, s.name as subject_name, s.code as subject_code, s.semester, s.branch,
        array_agg(json_build_object('id',pf.id,'url',pf.file_url,'name',pf.original_name,'type',pf.file_type,'size',pf.file_size)) FILTER (WHERE pf.id IS NOT NULL) as files
      FROM papers p
      JOIN subjects s ON p.subject_id=s.id
      LEFT JOIN paper_files pf ON pf.paper_id=p.id
    `;
    const params = [], conds = [];
    if (subject_id) { params.push(parseInt(subject_id)); conds.push(`p.subject_id=$${params.length}`); }
    if (year) { params.push(parseInt(year)); conds.push(`p.year=$${params.length}`); }
    if (exam_type) { params.push(exam_type); conds.push(`p.exam_type=$${params.length}`); }
    if (branch) { params.push(branch); conds.push(`s.branch=$${params.length}`); }
    if (semester) { params.push(parseInt(semester)); conds.push(`s.semester=$${params.length}`); }
    if (search) { params.push(`%${search}%`); conds.push(`(p.title ILIKE $${params.length} OR s.name ILIKE $${params.length})`); }
    if (conds.length) q += ' WHERE ' + conds.join(' AND ');
    q += ' GROUP BY p.id, s.id ORDER BY p.year DESC, s.name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/papers/:id', async (req, res) => {
  try {
    const { rows: p } = await pool.query(`
      SELECT p.*, s.name as subject_name, s.code as subject_code, s.semester, s.branch
      FROM papers p JOIN subjects s ON p.subject_id=s.id WHERE p.id=$1
    `, [req.params.id]);
    if (!p.length) return res.status(404).json({ error: 'Not found' });
    const { rows: files } = await pool.query('SELECT * FROM paper_files WHERE paper_id=$1 ORDER BY created_at', [req.params.id]);
    res.json({ ...p[0], files });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/papers', auth, upload.array('files', 10), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { subject_id, year, exam_type, title, description } = req.body;
    if (!subject_id || !year) return res.status(400).json({ error: 'subject_id and year required' });
    const { rows } = await client.query(
      'INSERT INTO papers (subject_id,year,exam_type,title,description) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [subject_id, year, exam_type || 'Annual', title, description]
    );
    const paper = rows[0];
    if (req.files && req.files.length) {
      for (const f of req.files) {
        await client.query(
          'INSERT INTO paper_files (paper_id,filename,original_name,file_type,file_size,file_url) VALUES ($1,$2,$3,$4,$5,$6)',
          [paper.id, f.filename, f.originalname, f.mimetype, f.size, `/uploads/${f.filename}`]
        );
      }
    }
    await client.query('COMMIT');
    const { rows: files } = await pool.query('SELECT * FROM paper_files WHERE paper_id=$1', [paper.id]);
    res.status(201).json({ ...paper, files });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.post('/api/papers/:id/files', auth, upload.array('files', 10), async (req, res) => {
  try {
    const paperId = parseInt(req.params.id);
    const { rows: paper } = await pool.query('SELECT id FROM papers WHERE id=$1', [paperId]);
    if (!paper.length) return res.status(404).json({ error: 'Paper not found' });
    const inserted = [];
    for (const f of (req.files || [])) {
      const { rows } = await pool.query(
        'INSERT INTO paper_files (paper_id,filename,original_name,file_type,file_size,file_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [paperId, f.filename, f.originalname, f.mimetype, f.size, `/uploads/${f.filename}`]
      );
      inserted.push(rows[0]);
    }
    res.status(201).json(inserted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/papers/:id', auth, async (req, res) => {
  try {
    const { rows: files } = await pool.query('SELECT filename FROM paper_files WHERE paper_id=$1', [req.params.id]);
    for (const f of files) {
      const fp = path.join(__dirname, 'uploads', f.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    const { rowCount } = await pool.query('DELETE FROM papers WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/papers/files/:fileId', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM paper_files WHERE id=$1', [req.params.fileId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const fp = path.join(__dirname, 'uploads', rows[0].filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await pool.query('DELETE FROM paper_files WHERE id=$1', [req.params.fileId]);
    res.json({ message: 'File deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NOTES (anonymous) ────────────────────────────────────────────────────────
app.get('/api/notes', async (req, res) => {
  try {
    const { subject_id } = req.query;
    let q = 'SELECT n.*, s.name as subject_name FROM notes n LEFT JOIN subjects s ON n.subject_id=s.id';
    const params = [];
    if (subject_id) { params.push(parseInt(subject_id)); q += ` WHERE n.subject_id=$1`; }
    q += ' ORDER BY n.created_at DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notes', async (req, res) => {
  try {
    const { subject_id, title, content, color } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    const { rows } = await pool.query(
      'INSERT INTO notes (subject_id,title,content,color) VALUES ($1,$2,$3,$4) RETURNING *',
      [subject_id || null, title, content, color || 'default']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM notes WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── STATS ────────────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [s, p, y, u, n] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM subjects'),
      pool.query('SELECT COUNT(*) FROM papers'),
      pool.query('SELECT COUNT(DISTINCT year) FROM papers'),
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM notes')
    ]);
    res.json({
      totalSubjects: parseInt(s.rows[0].count),
      totalPapers: parseInt(p.rows[0].count),
      totalYears: parseInt(y.rows[0].count),
      totalUsers: parseInt(u.rows[0].count),
      totalNotes: parseInt(n.rows[0].count)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AI CHAT ──────────────────────────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { question, subjectId, sessionId, history = [] } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });

    let subjectContext = '';
    let papersContext = '';

    if (subjectId) {
      const { rows: sub } = await pool.query('SELECT * FROM subjects WHERE id=$1', [subjectId]);
      if (sub.length) {
        const s = sub[0];
        subjectContext = `Subject: ${s.name} (${s.code}), Semester ${s.semester}, Branch: ${s.branch}. Description: ${s.description || ''}`;
        const { rows: papers } = await pool.query(
          'SELECT year, exam_type, title, description FROM papers WHERE subject_id=$1 ORDER BY year DESC',
          [subjectId]
        );
        if (papers.length) {
          const byType = {};
          for (const p of papers) {
            if (!byType[p.exam_type]) byType[p.exam_type] = [];
            byType[p.exam_type].push(p.year);
          }
          papersContext = 'Available papers:\n' + Object.entries(byType).map(([type, years]) =>
            `${type}: years ${years.join(', ')}`
          ).join('\n');
        }
      }
    }

    const systemPrompt = `You are an expert academic AI assistant for NCET (New College of Engineering and Technology) students. You analyze previous year question papers and provide intelligent insights.

${subjectContext ? `Context:\n${subjectContext}\n${papersContext}` : 'You help students with all engineering subjects.'}

Your capabilities:
- Predict important questions based on patterns across years
- Identify frequently repeated questions and topics  
- Segregate important questions by exam type (IUT-1: Internal Unit Test 1 covers first 2-3 units, IUT-2: covers next 2-3 units, ESE: End Semester Exam covers all units)
- Suggest high-weightage topics and most-likely exam questions
- Provide concise, well-structured answers with bullet points

Always format your response clearly with sections when relevant. Be specific and exam-focused.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: question }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1500,
      temperature: 0.7
    });

    const answer = completion.choices[0].message.content;

    if (sessionId && subjectId) {
      await pool.query('INSERT INTO ai_chats (session_id,subject_id,role,content) VALUES ($1,$2,$3,$4)', [sessionId, subjectId, 'user', question]);
      await pool.query('INSERT INTO ai_chats (session_id,subject_id,role,content) VALUES ($1,$2,$3,$4)', [sessionId, subjectId, 'assistant', answer]);
    }

    res.json({ answer, tokens: completion.usage });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: 'AI service error. Please try again.' });
  }
});

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { subjectId } = req.body;
    if (!subjectId) return res.status(400).json({ error: 'subjectId required' });

    const { rows: sub } = await pool.query('SELECT * FROM subjects WHERE id=$1', [subjectId]);
    if (!sub.length) return res.status(404).json({ error: 'Subject not found' });
    const s = sub[0];

    const { rows: papers } = await pool.query(
      'SELECT year, exam_type, title, description FROM papers WHERE subject_id=$1 ORDER BY year, exam_type',
      [subjectId]
    );

    const papersText = papers.map(p => `${p.year} ${p.exam_type}: ${p.description || p.title || ''}`).join('\n');

    const prompt = `Analyze these previous year papers for ${s.name} (${s.code}), Semester ${s.semester}, ${s.branch} branch at an engineering college.

Papers available:
${papersText}

Based on the subject content and typical engineering exam patterns, provide:

1. **IUT-1 Important Questions** (Units 1-3): Top 5 most important questions likely to appear
2. **IUT-2 Important Questions** (Units 4-6): Top 5 most important questions likely to appear  
3. **ESE Important Questions** (All units): Top 8 most important questions for end semester
4. **Most Repeated Topics**: Topics that appear consistently across years
5. **High-Priority Concepts**: Must-know concepts for scoring well
6. **Predicted Questions for ${new Date().getFullYear()}**: Based on patterns, what's likely to come

Format with clear headings and bullet points. Be specific and academically accurate.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert in engineering education and exam analysis. Provide detailed, accurate academic insights.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.5
    });

    res.json({ analysis: completion.choices[0].message.content, subject: s });
  } catch (err) {
    console.error('AI analyze error:', err.message);
    res.status(500).json({ error: 'AI service error' });
  }
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
});
