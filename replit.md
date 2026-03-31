# NCET Previous Year Paper Tracker

A full-stack web application for browsing and tracking previous year question papers for NCET (New College of Engineering and Technology).

## Stack

- **Frontend**: React 18 + Vite (port 5000)
- **Backend**: Express.js (port 3000)
- **Database**: PostgreSQL (Replit built-in)
- **Language**: JavaScript (Node.js 20)

## Project Structure

```
/
├── server/          # Express.js API server
│   ├── index.js     # Main server file with all routes
│   └── package.json
├── client/          # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Subjects.jsx
│   │       ├── SubjectDetail.jsx
│   │       └── Papers.jsx
│   ├── vite.config.js
│   └── package.json
├── start.js         # Startup orchestrator (starts server, then client)
└── package.json     # Root package.json
```

## Running the App

The `Start application` workflow runs `node start.js` which:
1. Starts the Express backend on `127.0.0.1:3000`
2. Waits 2 seconds, then starts Vite dev server on `0.0.0.0:5000`
3. Vite proxies `/api/*` requests to the backend

## API Endpoints

- `GET /api/health` — Health check
- `GET /api/subjects` — List all subjects (filter by semester, branch)
- `POST /api/subjects` — Add a new subject
- `GET /api/subjects/:id` — Get subject by ID
- `GET /api/papers` — List all papers (filter by subject_id, year, exam_type)
- `GET /api/papers/:id` — Get paper by ID
- `POST /api/papers` — Add a new paper
- `DELETE /api/papers/:id` — Delete a paper
- `GET /api/stats` — Stats (total subjects, papers, years)

## Database Schema

- **subjects**: id, name, code, semester, branch, created_at
- **papers**: id, subject_id, year, exam_type, description, file_url, created_at

## Features

- Browse subjects by semester and branch
- View all question papers with filtering by subject, year, exam type
- Add new subjects and papers
- Delete papers
- Sample data pre-loaded (10 subjects, 9 papers)
