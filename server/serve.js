const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

async function initDb() {
  try {
    const { data: existingSubjects, error: checkError } = await supabase
      .from('subjects')
      .select('id')
      .limit(1);

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (!existingSubjects || existingSubjects.length === 0) {
      const subjectsData = [
        { name: 'Engineering Mathematics I', code: 'MATH101', semester: 1, branch: 'Common' },
        { name: 'Engineering Physics', code: 'PHY101', semester: 1, branch: 'Common' },
        { name: 'Engineering Chemistry', code: 'CHEM101', semester: 1, branch: 'Common' },
        { name: 'Computer Science Fundamentals', code: 'CS101', semester: 2, branch: 'CSE' },
        { name: 'Data Structures', code: 'CS201', semester: 3, branch: 'CSE' },
        { name: 'Database Management Systems', code: 'CS301', semester: 4, branch: 'CSE' },
        { name: 'Operating Systems', code: 'CS401', semester: 5, branch: 'CSE' },
        { name: 'Computer Networks', code: 'CS402', semester: 5, branch: 'CSE' },
        { name: 'Software Engineering', code: 'CS501', semester: 6, branch: 'CSE' },
        { name: 'Compiler Design', code: 'CS502', semester: 6, branch: 'CSE' }
      ];

      const { data: insertedSubjects, error: insertError } = await supabase
        .from('subjects')
        .insert(subjectsData)
        .select();

      if (insertError) throw insertError;

      for (const subject of insertedSubjects.slice(0, 3)) {
        const papersData = [2021, 2022, 2023].map(year => ({
          subject_id: subject.id,
          year,
          exam_type: 'Annual',
          description: `${year} Annual Examination Paper`
        }));

        const { error: paperError } = await supabase
          .from('papers')
          .insert(papersData);

        if (paperError) throw paperError;
      }
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'NCET Paper Tracker API is running' }));

app.get('/api/subjects', async (req, res) => {
  try {
    const { semester, branch } = req.query;
    let query = supabase.from('subjects').select('*');
    if (semester) query = query.eq('semester', parseInt(semester));
    if (branch) query = query.eq('branch', branch);
    const { data, error } = await query.order('semester').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/subjects/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Subject not found' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const { name, code, semester, branch } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name is required' });
    const { data, error } = await supabase
      .from('subjects')
      .insert([{ name, code, semester, branch }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/papers', async (req, res) => {
  try {
    const { subject_id, year, exam_type } = req.query;
    let query = supabase.from('papers').select('*, subjects(name, code, semester, branch)');
    if (subject_id) query = query.eq('subject_id', parseInt(subject_id));
    if (year) query = query.eq('year', parseInt(year));
    if (exam_type) query = query.eq('exam_type', exam_type);
    const { data, error } = await query.order('year', { ascending: false }).order('subjects(name)');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/papers/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('papers')
      .select('*, subjects(name, code, semester, branch)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Paper not found' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/papers', async (req, res) => {
  try {
    const { subject_id, year, exam_type, description, file_url } = req.body;
    if (!subject_id || !year) return res.status(400).json({ error: 'subject_id and year are required' });
    const { data, error } = await supabase
      .from('papers')
      .insert([{ subject_id, year, exam_type: exam_type || 'Annual', description, file_url }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/papers/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('papers')
      .delete()
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Paper not found' });
    res.json({ message: 'Paper deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [subjectsCount, papersCount, yearsCount] = await Promise.all([
      supabase.from('subjects').select('*', { count: 'exact', head: true }),
      supabase.from('papers').select('*', { count: 'exact', head: true }),
      supabase.from('papers').select('year', { head: true })
    ]);
    const uniqueYears = await supabase.from('papers').select('year').then(r => new Set(r.data.map(p => p.year)).size);
    res.json({
      totalSubjects: subjectsCount.count || 0,
      totalPapers: papersCount.count || 0,
      totalYears: uniqueYears
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(express.static(path.join(__dirname, '../client/dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
app.get('*', (req, res) => {
  if (req.path.startsWith('/__replco') || req.path.startsWith('/__repl')) {
    return res.status(404).send('Not found');
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

initDb().then(() => {
  // Listen on port 5000 (workflow waitForPort) and port 3000 (first entry in
  // .replit [[ports]] externalPort=80 mapping) so all Replit routing works
  const ports = [5000, 3000];
  ports.forEach((p) => {
    app.listen(p, '0.0.0.0', () => {
      console.log(`Server listening on port ${p}`);
    }).on('error', (err) => {
      if (err.code !== 'EADDRINUSE') console.error(`Port ${p} error:`, err.message);
    });
  });
});
