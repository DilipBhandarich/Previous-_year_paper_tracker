const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
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

const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || "10", 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || "60",
  10,
);

const isEmail = (value) => /.+@.+\..+/.test(String(value || "").trim());
const makeOtp = () => String(Math.floor(100000 + Math.random() * 900000));

let mailTransporter = null;
const configureMailer = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure =
    String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  if (!host || !user || !pass) {
    console.warn(
      "SMTP not configured. OTP will be logged to server console for development.",
    );
    return;
  }
  mailTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const sendOtpEmail = async (toEmail, otp) => {
  if (!mailTransporter) {
    console.log(`[DEV OTP] ${toEmail} => ${otp}`);
    return;
  }
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  await mailTransporter.sendMail({
    from: fromEmail,
    to: toEmail,
    subject: "Your NCET Paper Tracker OTP",
    text: `Your OTP is ${otp}. It will expire in ${OTP_TTL_MINUTES} minutes.`,
    html: `<p>Your OTP is <b>${otp}</b>.</p><p>This OTP will expire in ${OTP_TTL_MINUTES} minutes.</p>`,
  });
};

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime =
      allowed.test(file.mimetype) || file.mimetype === "application/pdf";
    cb(null, ext && mime);
  },
});

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
    await client.query(`CREATE TABLE IF NOT EXISTS email_otps (
      id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL, otp_hash VARCHAR(255) NOT NULL,
      attempt_count INTEGER DEFAULT 0, expires_at TIMESTAMP NOT NULL,
      consumed BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(
      "ALTER TABLE email_otps ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email)",
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

app.post("/api/auth/register/request-otp", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });
    if (!isEmail(email))
      return res.status(400).json({ error: "Valid email required" });
    if (String(password).length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [
      normalizedEmail,
    ]);
    if (existing.rows.length)
      return res.status(400).json({ error: "Email already registered" });

    const { rows: latestOtpRows } = await pool.query(
      `SELECT GREATEST(EXTRACT(EPOCH FROM ((created_at + ($2::text || ' seconds')::interval) - NOW())), 0)::INT AS wait_seconds
       FROM email_otps WHERE email=$1 AND consumed=FALSE ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, OTP_RESEND_COOLDOWN_SECONDS],
    );
    if (latestOtpRows.length) {
      const waitSeconds = parseInt(latestOtpRows[0].wait_seconds || 0, 10);
      if (waitSeconds > 0) {
        return res
          .status(429)
          .json({
            error: `Please wait ${waitSeconds}s before requesting another OTP.`,
            retryAfterSeconds: waitSeconds,
          });
      }
    }

    const otp = makeOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      "DELETE FROM email_otps WHERE email=$1 AND consumed=FALSE",
      [normalizedEmail],
    );
    await pool.query(
      "INSERT INTO email_otps (email,name,password_hash,otp_hash,attempt_count,expires_at) VALUES ($1,$2,$3,$4,0,NOW() + ($5::text || ' minutes')::interval)",
      [
        normalizedEmail,
        String(name).trim(),
        passwordHash,
        otpHash,
        OTP_TTL_MINUTES,
      ],
    );

    await sendOtpEmail(normalizedEmail, otp);

    const devOtp = process.env.NODE_ENV === "production" ? undefined : otp;
    res.status(200).json({
      message: "OTP sent to email",
      expiresInSeconds: OTP_TTL_MINUTES * 60,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      maxAttempts: OTP_MAX_ATTEMPTS,
      ...(devOtp ? { devOtp } : {}),
    });
  } catch (err) {
    console.error("Register OTP error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/register/verify-otp", async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ error: "Email and OTP required" });
    const normalizedEmail = String(email).trim().toLowerCase();

    await client.query("BEGIN");
    const { rows: otpRows } = await client.query(
      `SELECT *, (expires_at <= NOW()) AS is_expired FROM email_otps
       WHERE email=$1 AND consumed=FALSE ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [normalizedEmail],
    );

    if (!otpRows.length) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "No active OTP found. Please request a new OTP." });
    }

    const otpRow = otpRows[0];
    if (otpRow.is_expired) {
      await client.query("UPDATE email_otps SET consumed=TRUE WHERE id=$1", [
        otpRow.id,
      ]);
      await client.query("COMMIT");
      return res
        .status(400)
        .json({ error: "OTP expired. Please request a new OTP." });
    }

    if ((otpRow.attempt_count || 0) >= OTP_MAX_ATTEMPTS) {
      await client.query("UPDATE email_otps SET consumed=TRUE WHERE id=$1", [
        otpRow.id,
      ]);
      await client.query("COMMIT");
      return res
        .status(429)
        .json({
          error: "Too many invalid OTP attempts. Please request a new OTP.",
        });
    }

    const ok = await bcrypt.compare(String(otp), otpRow.otp_hash);
    if (!ok) {
      const nextAttempts = (otpRow.attempt_count || 0) + 1;
      const remaining = Math.max(OTP_MAX_ATTEMPTS - nextAttempts, 0);
      if (remaining === 0) {
        await client.query(
          "UPDATE email_otps SET consumed=TRUE, attempt_count=$1 WHERE id=$2",
          [nextAttempts, otpRow.id],
        );
        await client.query("COMMIT");
        return res
          .status(429)
          .json({
            error: "Too many invalid OTP attempts. Please request a new OTP.",
          });
      }
      await client.query("UPDATE email_otps SET attempt_count=$1 WHERE id=$2", [
        nextAttempts,
        otpRow.id,
      ]);
      await client.query("COMMIT");
      return res
        .status(400)
        .json({ error: `Invalid OTP. ${remaining} attempt(s) remaining.` });
    }

    const { rows: existingUser } = await client.query(
      "SELECT id FROM users WHERE email=$1 FOR UPDATE",
      [normalizedEmail],
    );
    if (existingUser.length) {
      await client.query("UPDATE email_otps SET consumed=TRUE WHERE id=$1", [
        otpRow.id,
      ]);
      await client.query("COMMIT");
      return res.status(400).json({ error: "Email already registered" });
    }

    // Create the user account now that OTP is verified
    await client.query("UPDATE email_otps SET consumed=TRUE WHERE id=$1", [
      otpRow.id,
    ]);
    const insertRes = await client.query(
      `INSERT INTO users (name, email, password, email_verified, role, avatar)
       VALUES ($1, $2, $3, TRUE, $4, $5) RETURNING id, name, email, role, avatar, created_at`,
      [
        String(otpRow.name || req.body.name || "").trim(),
        normalizedEmail,
        otpRow.password_hash,
        "student",
        "blue",
      ],
    );

    const newUser = insertRes.rows[0];
    await client.query("COMMIT");
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
    );
    return res.status(200).json({ token, user: newUser });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("Verify OTP error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Initialize DB and start the server
initDb()
  .then(() => {
    app
      .listen(PORT, "0.0.0.0", () => {
        console.log(`Server listening on port ${PORT}`);
      })
      .on("error", (err) => {
        if (err.code !== "EADDRINUSE")
          console.error("Server error:", err.message);
      });
  })
  .catch((err) => {
    console.error(
      "Failed to initialize database:",
      err && err.message ? err.message : err,
    );
  });
