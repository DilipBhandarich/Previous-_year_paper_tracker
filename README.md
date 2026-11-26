# NCET Previous Year Paper Tracker

React/Vite frontend with an Express/PostgreSQL API for NCET students. The
production deployment uses Vercel Functions for the API, Supabase PostgreSQL
for data, and Supabase Storage for uploaded paper files.

## Local development

1. Copy `.env.example` to `.env` and fill in the values.
2. Run `npm install`, then `npm run dev`.
3. Open `http://localhost:5000`.

The backend creates the application tables and seed subjects on first startup.

## Vercel deployment

Import the repository into Vercel with the repository root as the project root.
The included `vercel.json` uses `npm run build`, publishes `client/dist`, and
routes `/api/*` to the serverless Express handler in `api/[...path].js`.

Add these Vercel environment variables for Production:

- `DATABASE_URL`: Supabase Session Pooler connection string.
- `JWT_SECRET`: a new long random value.
- `SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: the Supabase service-role key; keep it server-only.
- `SUPABASE_STORAGE_BUCKET`: `paper-files`.
- `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, and `AI_MODEL` for AI features.

Create a public Supabase Storage bucket named `paper-files` before uploading
papers. Never add `.env` or any service-role key to Git.
