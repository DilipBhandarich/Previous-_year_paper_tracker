const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const OpenAI = require("openai");
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required");
  process.exit(1);
}

const isEmail = (value) => /.+@.+\..+/.test(String(value || "").trim());

let openai;
const normalizeOpenAiBaseUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return undefined;
  return url.endsWith("/") ? url : `${url}/`;
};

const AI_API_KEY =
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.GEMINI_API_KEY;
const AI_BASE_URL = normalizeOpenAiBaseUrl(
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
);
const isGoogleOpenAiCompat = String(AI_BASE_URL || "").includes(
  "generativelanguage.googleapis.com",
);

try {
  if (!AI_API_KEY) {
    openai = null;
    console.warn(
      "AI API key not configured. Set AI_INTEGRATIONS_OPENAI_API_KEY (or GEMINI_API_KEY) to enable AI features.",
    );
  } else {
    openai = new OpenAI({
      apiKey: AI_API_KEY,
      baseURL: AI_BASE_URL,
      timeout: 30000,
    });
  }
} catch (e) {
  console.log("OpenAI not available, AI features disabled");
  openai = null;
}

const AI_MODEL =
  process.env.AI_MODEL ||
  (isGoogleOpenAiCompat ? "gemini-2.0-flash" : "gpt-4o-mini");
const AI_MODELS = [
  ...new Set([
    ...(process.env.AI_MODELS
      ? process.env.AI_MODELS.split(",")
          .map((m) => m.trim())
          .filter(Boolean)
      : []),
    AI_MODEL,
    ...(isGoogleOpenAiCompat
      ? [
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-2.0-flash-lite",
          "gemini-1.5-flash",
        ]
      : ["gpt-4o-mini"]),
  ]),
];

const getAiErrorStatus = (err) => {
  const msg = String(err?.message || "");
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.code === "number") return err.code;
  if (msg.includes("429")) return 429;
  if (msg.includes("401")) return 401;
  if (msg.includes("403")) return 403;
  if (msg.includes("400")) return 400;
  if (msg.includes("503")) return 503;
  return 500;
};

const getAiErrorText = (err) => {
  return [
    err?.message,
    err?.error?.message,
    err?.response?.data?.error?.message,
    err?.response?.data?.error,
  ]
    .filter(Boolean)
    .map((v) => String(v))
    .join(" | ")
    .toLowerCase();
};

let aiRateLimitedUntil = 0;
const AI_RATE_LIMIT_COOLDOWN_MS = parseInt(
  process.env.AI_RATE_LIMIT_COOLDOWN_MS || "60000",
  10,
);

const getAiCooldownSeconds = () => {
  if (Date.now() >= aiRateLimitedUntil) return 0;
  return Math.ceil((aiRateLimitedUntil - Date.now()) / 1000);
};

const shouldTryNextAiModel = (err) => {
  const status = getAiErrorStatus(err);
  const msg = getAiErrorText(err);
  if (status === 429) return false;
  if (status === 503 || status === 404) return true;
  if (
    status === 400 &&
    /(model|unsupported|not found|does not exist|unknown model)/.test(msg)
  )
    return true;
  return false;
};

async function createAiCompletionWithFallback(
  messages,
  maxTokens,
  temperature,
) {
  let lastErr;
  let prioritizedErr;
  for (let i = 0; i < AI_MODELS.length; i += 1) {
    const model = AI_MODELS[i];
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      });
      return completion;
    } catch (err) {
      lastErr = err;
      const status = getAiErrorStatus(err);
      if (status === 429) {
        aiRateLimitedUntil = Math.max(
          aiRateLimitedUntil,
          Date.now() + AI_RATE_LIMIT_COOLDOWN_MS,
        );
      }
      if (
        !prioritizedErr &&
        (status === 429 || status === 401 || status === 403)
      ) {
        prioritizedErr = err;
      }
      if (!shouldTryNextAiModel(err) || i === AI_MODELS.length - 1) break;
      console.warn(
        `AI model "${model}" failed (${getAiErrorStatus(err)}). Trying next model...`,
      );
    }
  }
  throw prioritizedErr || lastErr;
}

const dbUrl = process.env.DATABASE_URL;
console.log(
  "DB URL configured:",
  dbUrl
    ? "Yes (" + dbUrl.replace(/:[^:@]+@/, ":***@").substring(0, 60) + "...)"
    : "NO - set DATABASE_URL in .env",
);

const isIpv6LiteralDbUrl = (() => {
  if (!dbUrl) return false;
  try {
    return new URL(dbUrl).hostname.includes(":");
  } catch {
    return false;
  }
})();

if (isIpv6LiteralDbUrl) {
  console.warn(
    "DATABASE_URL uses an IPv6 literal host. If your network does not support IPv6 routing, DB connections will time out.",
  );
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  statement_timeout: 30000,
});

pool.on("error", (err) => console.error("Unexpected pool error:", err.message));
pool.on("connect", () => console.log("Database connection established"));
pool.on("remove", () => console.log("Database connection removed from pool"));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(compression());

const corsOrigin =
  process.env.CORS_ORIGIN ||
  (process.env.NODE_ENV === "production" ? false : "*");
app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit exceeded. Please slow down." },
});
app.use(generalLimiter);
app.use("/api/auth/", authLimiter);
app.use("/api/ai/", aiLimiter);

app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Files are kept in memory during a request. Vercel's filesystem is ephemeral,
// so production uploads go to Supabase Storage; local development falls back
// to server/uploads for convenience.
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime =
      allowed.test(file.mimetype) || file.mimetype === "application/pdf";
    cb(null, ext && mime ? null : new Error("Unsupported file type"));
  },
});

const storageUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const storageKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "paper-files";
const hasObjectStorage = Boolean(storageUrl && storageKey);

function safeFileName(value) {
  return String(value || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";
}

async function storeFile(file) {
  const objectPath = `papers/${crypto.randomUUID()}-${safeFileName(file.originalname)}`;
  if (hasObjectStorage) {
    const response = await fetch(
      `${storageUrl}/storage/v1/object/${encodeURIComponent(storageBucket)}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${storageKey}`,
          apikey: storageKey,
          "Content-Type": file.mimetype,
          "x-upsert": "false",
        },
        body: file.buffer,
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Storage upload failed (${response.status}): ${detail}`);
    }
    return {
      filename: objectPath,
      file_url: `${storageUrl}/storage/v1/object/public/${storageBucket}/${objectPath}`,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Supabase Storage is not configured for production uploads");
  }
  const localName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`;
  const dir = path.join(__dirname, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, localName), file.buffer);
  return { filename: localName, file_url: `/uploads/${localName}` };
}

function storagePathUrl(pathname) {
  return String(pathname)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function validateUploadMetadata(file) {
  const originalName = String(file?.name || file?.original_name || "file").trim().slice(0, 255);
  const fileType = String(file?.type || file?.file_type || "").toLowerCase();
  const extension = path.extname(originalName).toLowerCase();
  const validExtension = /\.(jpeg|jpg|png|gif|webp|pdf)$/i.test(extension);
  const validType = /^(image\/(jpeg|jpg|png|gif|webp)|application\/pdf)$/.test(fileType);
  const fileSize = Number(file?.size || file?.file_size || 0);
  if (!originalName || !validExtension || !validType || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 20 * 1024 * 1024) {
    throw new Error("Unsupported or oversized file");
  }
  return { originalName, fileType, fileSize };
}

async function createSignedUpload(file) {
  if (!hasObjectStorage) throw new Error("Supabase Storage is not configured for production uploads");
  const { originalName, fileType, fileSize } = validateUploadMetadata(file);
  const objectPath = `papers/${crypto.randomUUID()}-${safeFileName(originalName)}`;
  const signedPath = `${encodeURIComponent(storageBucket)}/${storagePathUrl(objectPath)}`;
  const response = await fetch(
    `${storageUrl}/storage/v1/object/upload/sign/${signedPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${storageKey}`,
        apikey: storageKey,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Storage signing failed (${response.status}): ${detail}`);
  }
  const signed = await response.json();
  if (!signed.token) throw new Error("Storage did not return an upload token");
  return {
    filename: objectPath,
    original_name: originalName,
    file_type: fileType,
    file_size: fileSize,
    upload_url: `${storageUrl}/storage/v1/object/upload/sign/${signedPath}?token=${encodeURIComponent(signed.token)}`,
    file_url: `${storageUrl}/storage/v1/object/public/${storageBucket}/${objectPath}`,
  };
}

async function removeStoredFile(filename) {
  if (!filename) return;
  if (hasObjectStorage && String(filename).startsWith("papers/")) {
    await fetch(`${storageUrl}/storage/v1/object/remove`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${storageKey}`,
        apikey: storageKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId: storageBucket, prefixes: [filename] }),
    });
    return;
  }
  const localPath = path.join(__dirname, "uploads", path.basename(filename));
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
}

const auth = require("./middleware/auth");

function getOrderedUploadFiles(rawFiles) {
  return (rawFiles || [])
    .map((f, i) => {
      const match = String(f.fieldname || "").match(/^files_(\d+)$/);
      return { ...f, _inputOrder: match ? parseInt(match[1], 10) : i };
    })
    .sort((a, b) => a._inputOrder - b._inputOrder);
}

async function isOwnerOrAdmin(client, table, id, userId) {
  const { rows } = await client.query(
    `SELECT created_by FROM ${table} WHERE id=$1`,
    [id],
  );
  if (!rows.length) return { exists: false, allowed: false };
  return {
    exists: true,
    allowed: rows[0].created_by === userId || rows[0].created_by === null,
  };
}

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL, email_verified BOOLEAN DEFAULT FALSE,
      role VARCHAR(50) DEFAULT 'student', avatar VARCHAR(50) DEFAULT 'blue', created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
    );
    await client.query(`CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50), semester INTEGER,
      branch VARCHAR(100), description TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(
      "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL",
    );
    await client.query(`CREATE TABLE IF NOT EXISTS papers (
      id SERIAL PRIMARY KEY, subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
      title VARCHAR(500), year INTEGER NOT NULL, exam_type VARCHAR(50) DEFAULT 'Annual',
      description TEXT, file_url TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(
      "ALTER TABLE papers ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL",
    );
    await client.query(`CREATE TABLE IF NOT EXISTS paper_files (
      id SERIAL PRIMARY KEY, paper_id INTEGER REFERENCES papers(id) ON DELETE CASCADE,
      file_order INTEGER DEFAULT 0, filename VARCHAR(255) NOT NULL, original_name VARCHAR(255),
      file_type VARCHAR(50), file_size BIGINT, file_url TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(
      "ALTER TABLE paper_files ADD COLUMN IF NOT EXISTS file_order INTEGER DEFAULT 0",
    );
    await client.query(`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY paper_id ORDER BY created_at ASC, id ASC) - 1 AS ord
        FROM paper_files
      )
      UPDATE paper_files pf SET file_order = ordered.ord
      FROM ordered WHERE pf.id = ordered.id AND (pf.file_order IS NULL OR pf.file_order = 0)
    `);
    await client.query(`CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY, subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(500), content TEXT NOT NULL, color VARCHAR(50) DEFAULT 'default',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(
      "ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
    );
    await client.query(`CREATE TABLE IF NOT EXISTS ai_chats (
      id SERIAL PRIMARY KEY, session_id VARCHAR(255), subject_id INTEGER,
      role VARCHAR(20) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW()
    )`);

    const { rows } = await client.query("SELECT COUNT(*) FROM subjects");
    if (parseInt(rows[0].count) === 0) {
      await client.query(`INSERT INTO subjects (name, code, semester, branch, description) VALUES
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
      const { rows: subs } = await client.query(
        "SELECT id FROM subjects LIMIT 5",
      );
      for (const s of subs) {
        for (const year of [2021, 2022, 2023, 2024]) {
          for (const exam of ["IAT-1", "IAT-2", "SEE"]) {
            await client.query(
              "INSERT INTO papers (subject_id, year, exam_type, title, description) VALUES ($1,$2,$3,$4,$5)",
              [
                s.id,
                year,
                exam,
                `${year} ${exam} Examination`,
                `${year} ${exam} Question Paper`,
              ],
            );
          }
        }
      }
    }
    await client.query(
      "UPDATE papers SET exam_type='IAT-1' WHERE exam_type='IUT-1'",
    );
    await client.query(
      "UPDATE papers SET exam_type='IAT-2' WHERE exam_type='IUT-2'",
    );
    await client.query(
      "UPDATE papers SET exam_type='SEE' WHERE exam_type='ESE'",
    );
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("DB init error:", err.message);
  } finally {
    client.release();
  }
}

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      database: "connected",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res
      .status(503)
      .json({
        status: "degraded",
        database: "disconnected",
        error: "Database connection failed",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
  }
});

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const userView = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  avatar: row.avatar,
  created_at: row.created_at,
});
const intParam = (value, fallback = null) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

async function ownsResource(table, id, user) {
  if (user?.role === "admin") return true;
  const result = await pool.query(`SELECT created_by FROM ${table} WHERE id=$1`, [id]);
  return Boolean(result.rows[0] && result.rows[0].created_by === user?.id);
}

function parseFiles(req) {
  return getOrderedUploadFiles(req.files).filter((file) => file?.buffer);
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });
    if (!isEmail(email)) return res.status(400).json({ error: "Valid email required" });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.rows.length) return res.status(400).json({ error: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name,email,password,email_verified,role,avatar)
       VALUES ($1,$2,$3,TRUE,'student','blue')
       RETURNING id,name,email,role,avatar,created_at`,
      [name, email, passwordHash],
    );
    const user = rows[0];
    return res.status(201).json({ token: issueToken(user), user });
  } catch (err) {
    console.error("Register error:", err.message);
    return res.status(500).json({ error: "Unable to create account" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ error: "All fields required" });
    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password)))
      return res.status(401).json({ error: "Invalid credentials" });
    const user = userView(rows[0]);
    return res.json({ token: issueToken(user), user });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Unable to sign in" });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id,name,email,role,avatar,created_at FROM users WHERE id=$1",
      [req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Unable to load account" });
  }
});

app.get("/api/subjects", async (req, res) => {
  try {
    const params = [];
    const conditions = [];
    const { semester, branch, search, sort = "semester" } = req.query;
    if (semester) { params.push(intParam(semester)); conditions.push(`s.semester=$${params.length}`); }
    if (branch) { params.push(String(branch)); conditions.push(`s.branch=$${params.length}`); }
    if (search) { params.push(`%${String(search)}%`); conditions.push(`(s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`); }
    let query = `SELECT s.*, COUNT(DISTINCT p.id)::int AS paper_count
      FROM subjects s LEFT JOIN papers p ON p.subject_id=s.id`;
    if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
    query += " GROUP BY s.id";
    const order = { semester: "s.semester, s.name", name: "s.name", branch: "s.branch, s.semester", papers: "paper_count DESC" };
    query += ` ORDER BY ${order[sort] || order.semester}`;
    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (err) { return res.status(500).json({ error: "Unable to load subjects" }); }
});

app.get("/api/subjects/:id", async (req, res) => {
  try {
    const { rows: subjects } = await pool.query("SELECT * FROM subjects WHERE id=$1", [req.params.id]);
    if (!subjects.length) return res.status(404).json({ error: "Subject not found" });
    const { rows: papers } = await pool.query(
      `SELECT p.*, COALESCE(json_agg(json_build_object('id',pf.id,'url',pf.file_url,'name',pf.original_name,'type',pf.file_type,'size',pf.file_size) ORDER BY pf.created_at) FILTER (WHERE pf.id IS NOT NULL), '[]') AS files
       FROM papers p LEFT JOIN paper_files pf ON pf.paper_id=p.id
       WHERE p.subject_id=$1 GROUP BY p.id ORDER BY p.year DESC, p.exam_type`,
      [req.params.id],
    );
    return res.json({ ...subjects[0], papers });
  } catch (err) { return res.status(500).json({ error: "Unable to load subject" }); }
});

app.post("/api/papers/upload-urls", auth, async (req, res) => {
  try {
    const files = Array.isArray(req.body.files) ? req.body.files : [];
    if (!files.length) return res.status(400).json({ error: "At least one file is required" });
    if (files.length > 10) return res.status(400).json({ error: "You can upload up to 10 files" });
    const uploads = [];
    for (const file of files) uploads.push(await createSignedUpload(file));
    return res.json({ uploads });
  } catch (err) {
    console.error("Upload URL error:", err.message);
    return res.status(err.message.includes("not configured") ? 503 : 400).json({ error: err.message });
  }
});

app.post("/api/subjects", auth, async (req, res) => {
  try {
    const { name, code, semester, branch, description } = req.body;
    if (!String(name || "").trim()) return res.status(400).json({ error: "Name required" });
    const { rows } = await pool.query(
      `INSERT INTO subjects (name,code,semester,branch,description,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [String(name).trim(), code || null, intParam(semester), branch || null, description || null, req.user.id],
    );
    return res.status(201).json(rows[0]);
  } catch (err) { return res.status(500).json({ error: "Unable to create subject" }); }
});

app.put("/api/subjects/:id", auth, async (req, res) => {
  try {
    if (!(await ownsResource("subjects", req.params.id, req.user))) return res.status(403).json({ error: "You can only modify subjects you created" });
    const { name, code, semester, branch, description } = req.body;
    const { rows } = await pool.query(
      "UPDATE subjects SET name=$1,code=$2,semester=$3,branch=$4,description=$5 WHERE id=$6 RETURNING *",
      [name, code || null, intParam(semester), branch || null, description || null, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Subject not found" });
    return res.json(rows[0]);
  } catch (err) { return res.status(500).json({ error: "Unable to update subject" }); }
});

app.delete("/api/subjects/:id", auth, async (req, res) => {
  try {
    if (!(await ownsResource("subjects", req.params.id, req.user))) return res.status(403).json({ error: "You can only delete subjects you created" });
    const result = await pool.query("DELETE FROM subjects WHERE id=$1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Subject not found" });
    return res.json({ message: "Deleted" });
  } catch (err) { return res.status(500).json({ error: "Unable to delete subject" }); }
});

app.get("/api/papers", async (req, res) => {
  try {
    const params = [];
    const conditions = [];
    const { subject_id, year, exam_type, branch, semester, search, limit, offset } = req.query;
    if (subject_id) { params.push(intParam(subject_id)); conditions.push(`p.subject_id=$${params.length}`); }
    if (year) { params.push(intParam(year)); conditions.push(`p.year=$${params.length}`); }
    if (exam_type) { params.push(String(exam_type)); conditions.push(`p.exam_type=$${params.length}`); }
    if (branch) { params.push(String(branch)); conditions.push(`s.branch=$${params.length}`); }
    if (semester) { params.push(intParam(semester)); conditions.push(`s.semester=$${params.length}`); }
    if (search) { params.push(`%${String(search)}%`); conditions.push(`(p.title ILIKE $${params.length} OR s.name ILIKE $${params.length})`); }
    let query = `SELECT p.*,s.name AS subject_name,s.code AS subject_code,s.semester,s.branch,
      COALESCE(json_agg(json_build_object('id',pf.id,'url',pf.file_url,'name',pf.original_name,'type',pf.file_type,'size',pf.file_size) ORDER BY pf.created_at) FILTER (WHERE pf.id IS NOT NULL), '[]') AS files
      FROM papers p JOIN subjects s ON p.subject_id=s.id LEFT JOIN paper_files pf ON pf.paper_id=p.id`;
    if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
    query += " GROUP BY p.id,s.id ORDER BY p.year DESC,s.name";
    const safeLimit = Math.min(Math.max(intParam(limit, 100), 1), 100);
    const safeOffset = Math.max(intParam(offset, 0), 0);
    params.push(safeLimit, safeOffset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (err) { return res.status(500).json({ error: "Unable to load papers" }); }
});

app.get("/api/papers/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,s.name AS subject_name,s.code AS subject_code,s.semester,s.branch
       FROM papers p JOIN subjects s ON p.subject_id=s.id WHERE p.id=$1`, [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Paper not found" });
    const { rows: files } = await pool.query("SELECT * FROM paper_files WHERE paper_id=$1 ORDER BY created_at", [req.params.id]);
    return res.json({ ...rows[0], files });
  } catch (err) { return res.status(500).json({ error: "Unable to load paper" }); }
});

async function insertPaperFiles(client, paperId, files) {
  const stored = [];
  for (const file of files) {
    const saved = await storeFile(file);
    const { rows } = await client.query(
      `INSERT INTO paper_files (paper_id,filename,original_name,file_type,file_size,file_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [paperId, saved.filename, file.originalname, file.mimetype, file.size, saved.file_url],
    );
    stored.push(rows[0]);
  }
  return stored;
}

async function insertPaperFileMetadata(client, paperId, files) {
  const stored = [];
  for (const file of files) {
    const filename = String(file.filename || "");
    if (!filename.startsWith("papers/") || filename.includes("..")) throw new Error("Invalid uploaded file path");
    const originalName = String(file.original_name || "file").slice(0, 255);
    const fileType = String(file.file_type || "application/octet-stream");
    const fileSize = Number(file.file_size || 0);
    const fileUrl = hasObjectStorage
      ? `${storageUrl}/storage/v1/object/public/${storageBucket}/${filename}`
      : `/uploads/${path.basename(filename)}`;
    const { rows } = await client.query(
      `INSERT INTO paper_files (paper_id,filename,original_name,file_type,file_size,file_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [paperId, filename, originalName, fileType, fileSize, fileUrl],
    );
    stored.push(rows[0]);
  }
  return stored;
}

app.post("/api/papers", auth, upload.any(), async (req, res) => {
  const client = await pool.connect();
  const files = parseFiles(req);
  const metadataFiles = Array.isArray(req.body.files) ? req.body.files : [];
  const storedMetadata = metadataFiles.map((file) => ({ filename: file.filename }));
  try {
    const subjectId = intParam(req.body.subject_id);
    const year = intParam(req.body.year);
    if (!subjectId || !year) return res.status(400).json({ error: "subject_id and year required" });
    if (!files.length && !metadataFiles.length) return res.status(400).json({ error: "At least one file is required" });
    if (!files.length && !metadataFiles.some((file) => String(file.file_type || "").startsWith("image/"))) return res.status(400).json({ error: "At least one image file is required" });
    if (files.length && !files.some((file) => String(file.mimetype).startsWith("image/"))) return res.status(400).json({ error: "At least one image file is required" });
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO papers (subject_id,year,exam_type,title,description,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [subjectId, year, req.body.exam_type || "Annual", req.body.title || null, req.body.description || null, req.user.id],
    );
    const paperFiles = files.length
      ? await insertPaperFiles(client, rows[0].id, files)
      : await insertPaperFileMetadata(client, rows[0].id, metadataFiles);
    await client.query("COMMIT");
    return res.status(201).json({ ...rows[0], files: paperFiles });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    await Promise.allSettled(storedMetadata.map((file) => removeStoredFile(file.filename)));
    console.error("Paper upload error:", err.message);
    return res.status(500).json({ error: "Unable to upload paper" });
  } finally { client.release(); }
});

app.post("/api/papers/:id/files", auth, upload.any(), async (req, res) => {
  const client = await pool.connect();
  try {
    const files = parseFiles(req);
    const paperId = intParam(req.params.id);
    if (!files.length) return res.status(400).json({ error: "At least one file is required" });
    if (!(await ownsResource("papers", paperId, req.user))) return res.status(403).json({ error: "You can only upload files to papers you created" });
    await client.query("BEGIN");
    const inserted = await insertPaperFiles(client, paperId, files);
    await client.query("COMMIT");
    return res.status(201).json(inserted);
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    return res.status(500).json({ error: "Unable to upload files" });
  } finally { client.release(); }
});

app.delete("/api/papers/:id", auth, async (req, res) => {
  try {
    if (!(await ownsResource("papers", req.params.id, req.user))) return res.status(403).json({ error: "You can only delete papers you created" });
    const { rows: files } = await pool.query("SELECT filename FROM paper_files WHERE paper_id=$1", [req.params.id]);
    const result = await pool.query("DELETE FROM papers WHERE id=$1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Paper not found" });
    await Promise.allSettled(files.map((file) => removeStoredFile(file.filename)));
    return res.json({ message: "Deleted" });
  } catch (err) { return res.status(500).json({ error: "Unable to delete paper" }); }
});

app.delete("/api/papers/files/:fileId", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT pf.*,p.created_by FROM paper_files pf JOIN papers p ON p.id=pf.paper_id WHERE pf.id=$1", [req.params.fileId]);
    if (!rows.length) return res.status(404).json({ error: "File not found" });
    if (req.user.role !== "admin" && rows[0].created_by !== req.user.id) return res.status(403).json({ error: "You can only delete files from papers you created" });
    await pool.query("DELETE FROM paper_files WHERE id=$1", [req.params.fileId]);
    await removeStoredFile(rows[0].filename);
    return res.json({ message: "File deleted" });
  } catch (err) { return res.status(500).json({ error: "Unable to delete file" }); }
});

app.get("/api/notes", async (req, res) => {
  try {
    const params = [];
    let query = "SELECT n.*,s.name AS subject_name FROM notes n LEFT JOIN subjects s ON n.subject_id=s.id";
    if (req.query.subject_id) { params.push(intParam(req.query.subject_id)); query += " WHERE n.subject_id=$1"; }
    query += " ORDER BY n.created_at DESC";
    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (err) { return res.status(500).json({ error: "Unable to load notes" }); }
});

app.post("/api/notes", auth, async (req, res) => {
  try {
    const { subject_id, title, content, color } = req.body;
    if (!String(content || "").trim()) return res.status(400).json({ error: "Content required" });
    const { rows } = await pool.query(
      `INSERT INTO notes (subject_id,user_id,title,content,color) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [subject_id ? intParam(subject_id) : null, req.user.id, title || null, String(content).trim(), color || "default"],
    );
    return res.status(201).json(rows[0]);
  } catch (err) { return res.status(500).json({ error: "Unable to save note" }); }
});

app.delete("/api/notes/:id", auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT user_id FROM notes WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Note not found" });
    if (req.user.role !== "admin" && rows[0].user_id !== req.user.id) return res.status(403).json({ error: "You can only delete notes you created" });
    await pool.query("DELETE FROM notes WHERE id=$1", [req.params.id]);
    return res.json({ message: "Deleted" });
  } catch (err) { return res.status(500).json({ error: "Unable to delete note" }); }
});

app.get("/api/stats", async (req, res) => {
  try {
    const [subjects, papers, years, users, notes] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM subjects"),
      pool.query("SELECT COUNT(*) FROM papers"),
      pool.query("SELECT COUNT(DISTINCT year) FROM papers"),
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM notes"),
    ]);
    return res.json({
      totalSubjects: Number(subjects.rows[0].count),
      totalPapers: Number(papers.rows[0].count),
      totalYears: Number(years.rows[0].count),
      totalUsers: Number(users.rows[0].count),
      totalNotes: Number(notes.rows[0].count),
    });
  } catch (err) { return res.status(500).json({ error: "Unable to load statistics" }); }
});

async function getAiSubjectContext(subjectId) {
  let subjectContext = "";
  let papersContext = "";
  if (!subjectId) return { subjectContext, papersContext };
  const { rows: subjects } = await pool.query("SELECT * FROM subjects WHERE id=$1", [subjectId]);
  if (!subjects.length) return { subjectContext, papersContext };
  const subject = subjects[0];
  subjectContext = `Subject: ${subject.name} (${subject.code}), Semester ${subject.semester}, Branch: ${subject.branch}. Description: ${subject.description || ""}`;
  const { rows: papers } = await pool.query("SELECT year,exam_type,title,description FROM papers WHERE subject_id=$1 ORDER BY year DESC", [subjectId]);
  const grouped = {};
  papers.forEach((paper) => { (grouped[paper.exam_type] ||= []).push(paper.year); });
  papersContext = Object.entries(grouped).map(([type, years]) => `${type}: years ${years.join(", ")}`).join("\n");
  return { subjectContext, papersContext, subject };
}

function aiUnavailable(res) {
  const cooldown = getAiCooldownSeconds();
  if (cooldown) return res.status(429).json({ error: `AI is rate-limited. Try again in ${cooldown}s.` });
  return res.status(503).json({ error: "AI service is not configured. Please try again later." });
}

app.post("/api/ai/chat", auth, async (req, res) => {
  try {
    const { question, subjectId, sessionId, history = [] } = req.body;
    if (!String(question || "").trim()) return res.status(400).json({ error: "Question required" });
    if (!openai) return aiUnavailable(res);
    const { subjectContext, papersContext } = await getAiSubjectContext(intParam(subjectId));
    const messages = [
      { role: "system", content: `You are an expert academic AI assistant for NCET engineering students. Use this context when relevant:\n${subjectContext}\n${papersContext}\nGive concise, exam-focused, clearly structured answers.` },
      ...(Array.isArray(history) ? history.slice(-10).filter((item) => ["user", "assistant"].includes(item.role)).map((item) => ({ role: item.role, content: String(item.content || "").slice(0, 4000) })) : []),
      { role: "user", content: String(question).trim().slice(0, 4000) },
    ];
    const completion = await createAiCompletionWithFallback(messages, 1500, 0.7);
    const answer = completion.choices?.[0]?.message?.content || "No answer returned.";
    if (sessionId && subjectId) {
      await pool.query("INSERT INTO ai_chats (session_id,subject_id,role,content) VALUES ($1,$2,$3,$4)", [sessionId, subjectId, "user", question]);
      await pool.query("INSERT INTO ai_chats (session_id,subject_id,role,content) VALUES ($1,$2,$3,$4)", [sessionId, subjectId, "assistant", answer]);
    }
    return res.json({ answer, tokens: completion.usage });
  } catch (err) {
    console.error("AI chat error:", err.message);
    return res.status(getAiErrorStatus(err) === 429 ? 429 : 503).json({ error: "AI service is temporarily unavailable." });
  }
});

app.post("/api/ai/analyze", auth, async (req, res) => {
  try {
    if (!openai) return aiUnavailable(res);
    const subjectId = intParam(req.body.subjectId);
    const { subjectContext, subject } = await getAiSubjectContext(subjectId);
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    const { rows: papers } = await pool.query("SELECT year,exam_type,title,description FROM papers WHERE subject_id=$1 ORDER BY year,exam_type", [subjectId]);
    const paperText = papers.map((paper) => `${paper.year} ${paper.exam_type}: ${paper.description || paper.title || ""}`).join("\n");
    const completion = await createAiCompletionWithFallback([
      { role: "system", content: "You are an expert engineering exam analyst. Give accurate, practical study guidance." },
      { role: "user", content: `Analyze ${subjectContext}. Previous papers:\n${paperText}\nProvide IUT-1, IUT-2, ESE important questions, repeated topics, high-priority concepts, and predicted questions for ${new Date().getFullYear()}. Use clear headings and bullets.` },
    ], 2000, 0.5);
    return res.json({ analysis: completion.choices?.[0]?.message?.content || "No analysis returned.", subject });
  } catch (err) {
    console.error("AI analysis error:", err.message);
    return res.status(getAiErrorStatus(err) === 429 ? 429 : 503).json({ error: "AI service is temporarily unavailable." });
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint not found" }));
app.use((err, req, res, next) => {
  console.error("Unhandled request error:", err.message);
  if (res.headersSent) return next(err);
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({ error: "Request payload is too large" });
  }
  return res.status(500).json({ error: "Internal server error" });
});

let initPromise;
function initialize() {
  if (!initPromise) initPromise = initDb();
  return initPromise;
}

if (require.main === module) {
  initialize().then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`Server listening on port ${PORT}`));
  }).catch((err) => console.error("Failed to initialize database:", err.message));
}

module.exports = app;
module.exports.initialize = initialize;
