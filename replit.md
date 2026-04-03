# NCET Previous Year Paper Tracker

A fully-featured platform for NCET students to access previous year question papers, get AI-powered exam predictions, and share anonymous notes.

## Architecture

- **Frontend**: React + Vite (port 5000), dark glassmorphism UI with Framer Motion animations
- **Backend**: Express.js (port 3000), JWT authentication, multer file uploads
- **Database**: Replit PostgreSQL (via DATABASE_URL)
- **AI**: Replit OpenAI Integration (gpt-4o-mini), no API key needed
- **Start**: `node start.js` (runs both Express backend and Vite dev server)

## Features

1. **JWT Authentication** — Signup/Login with bcryptjs password hashing
2. **Subjects Library** — Browse by semester, branch, search/sort filters
3. **Question Papers** — Multi-file upload (up to 10 images/PDFs), file viewer, filter by year/exam type
4. **AI Chatbot** — Per-subject AI chat with IUT-1/IUT-2/ESE predictions
5. **AI Analysis** — Full paper pattern analysis with important topics
6. **Anonymous Notes** — Color-coded sticky notes, no identity stored
7. **Dashboard** — Stats overview, recent papers, quick access

## Key Files

- `start.js` — Starts both backend (3000) and frontend (5000)
- `server/index.js` — Express backend with all routes, DB init, AI integration
- `client/src/App.jsx` — React Router setup with auth guards
- `client/src/index.css` — Complete dark theme with CSS variables
- `client/src/context/AuthContext.jsx` — JWT auth context
- `client/src/pages/` — Landing, Login, Register, Dashboard, Subjects, SubjectDetail, Papers, Notes
- `client/src/components/Navbar.jsx` — Top navigation

## Database Tables

- `users` — id, name, email, password, role, created_at
- `subjects` — id, name, code, semester, branch, description, created_at
- `papers` — id, subject_id, title, year, exam_type, description, file_url, created_at
- `paper_files` — id, paper_id, filename, original_name, file_type, file_size, file_url, created_at
- `notes` — id, subject_id, title, content, color, created_at
- `ai_chats` — id, session_id, subject_id, role, content, created_at

## AI Integration

Uses `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` env vars from Replit OpenAI integration.
Model: gpt-4o-mini. Billed to Replit credits.

## File Uploads

Stored in `server/uploads/`, served at `/uploads/` static route. Supports JPG, PNG, GIF, WEBP, PDF. Max 10 files per paper, 50MB each.
