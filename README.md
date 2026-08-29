# CrackList

Free, community-run database of company-tagged technical interview questions.
Monorepo: a Vite/React frontend and a Node/Express/Prisma backend.

```
frontend/   Vite + React 19 + TypeScript SPA (graph browser, contribute, mod queue)
backend/    Express + TypeScript + Prisma + PostgreSQL API
```

## Prerequisites

- Node 18+
- PostgreSQL 14+ (or Docker)

## Backend

```bash
cd backend
cp .env.example .env          # set DATABASE_URL, DIRECT_URL, ADMIN_PASSWORD, SESSION_SECRET
npm install
npx prisma db push            # create tables from src/db/schema.prisma
npx prisma db seed            # load the PRD mock data
npm run dev                   # http://localhost:4000
```

Spin up Postgres with Docker if you don't have one:

```bash
docker run -d --name cracklist-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cracklist -p 5432:5432 postgres:16
```

### API

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET  | `/companies` · `/companies/:slug` | — | companies + computed stats |
| GET  | `/questions?companyId=&status=` · `/questions/:id` | — | list / read questions |
| POST | `/questions/:id/upvote` · `/questions/:id/confirm` | — | signal boosts |
| POST | `/submissions/structured` | — | create a pending question |
| POST | `/submissions/pdf` (multipart) | — | Path 2 file drop → `pdf_submissions` |
| POST | `/admin/login` · `/admin/logout` | — | signed httpOnly session cookie |
| GET  | `/admin/queue` · `/admin/pdf-inbox` | moderator | review data |
| POST | `/admin/questions/:id/approve` · `/reject` | moderator | moderation actions |

PDF files are written through `src/storage/pdf.ts` (local disk in v1 — swap for S3
without touching routes). Uploaded questions from Path 2 never auto-become questions;
a moderator creates one manually.

## Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Point it at a non-default API with `VITE_API_URL` (defaults to `http://localhost:4000`).
The data layer lives in `src/lib/store.tsx` — same action surface the pages already
use (`upvoteQuestion`, `confirmQuestion`, `submitStructured`, `submitPdf`,
`approveQuestion`, `rejectQuestion`), now backed by real fetch calls. `/admin/queue`
is gated by a moderator password login.

## Deployment stack

Database on **Supabase**, frontend on **Vercel**, backend on **Render**.

### Database (Supabase)

Create a project at supabase.com, then grab two connection strings from
Project Settings → Database → Connection string:

| Env var | Which one | Why |
|---|---|---|
| `DATABASE_URL` | **Transaction pooler** (port 6543), append `?pgbouncer=true` | runtime queries |
| `DIRECT_URL` | **Direct connection** (port 5432) | `prisma db push`/`migrate` — pgbouncer's pooled mode doesn't support the prepared statements these need |

Both go in `backend/.env` locally and as env vars on Render. Local Postgres/Docker doesn't
have this split — `DATABASE_URL` and `DIRECT_URL` can just be the same value there.

### Frontend (Vercel)

Monorepo, so set the project's **Root Directory to `frontend`** — Vercel's Vite preset
handles the build/output dirs automatically from there. Add one environment variable:

| Key | Value |
|---|---|
| `VITE_API_URL` | your deployed Render backend's URL |
| `VITE_SITE_URL` | the site's own production URL (e.g. `https://your-app.vercel.app`) |

Without `VITE_API_URL`, the deployed site calls `http://localhost:4000` from the visitor's
browser and every request fails — page loads, but shows 0 companies/questions.
`frontend/vercel.json` (SPA rewrite to `index.html`) is already in the repo — needed for
React Router's client-side routes (`/c/:slug`, `/q/:id`, etc.) to not 404 on direct load
or refresh.

`npm run build` also runs `scripts/prerender.mjs` after `vite build`, which hits the live
`VITE_API_URL` backend to generate a static, SEO-crawlable HTML file per company/question
page (~18k files), plus `sitemap.xml` and `robots.txt` in `dist/`. `VITE_SITE_URL` is what
gets written into those files' canonical links, OG tags, and sitemap entries — Vercel
serves a prerendered `dist/c/<slug>/index.html` directly for that path, ahead of the SPA
catch-all rewrite. If it's missing, the script falls back to a hardcoded placeholder
domain, so set it before deploying to a real domain.

### Backend (Render)

`backend/Dockerfile` builds the API as a container. Build context is the **repo root**
(needed so it can `COPY backend/...` — Docker only reads one `.dockerignore`, at the
context root, which is where `/.dockerignore` lives). On Render's "New Web Service" form:

| Field | Value |
|---|---|
| Language | Docker |
| Root Directory | *(leave blank)* |
| Dockerfile Path | `backend/Dockerfile` |
| Pre-Deploy Command (under Advanced) | `npx prisma db push` |

Environment variables:

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase pooled connection string |
| `DIRECT_URL` | Supabase direct connection string |
| `ADMIN_PASSWORD` | moderator login password |
| `SESSION_SECRET` | any long random string |
| `CORS_ORIGIN` | your Vercel frontend's URL |
| `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` (only for PDF uploads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role (server-only, never expose to the browser) |
| `SUPABASE_PDF_BUCKET` | name of a Storage bucket you create in Supabase for uploaded PDFs, e.g. `cracklist-pdfs` |

`PORT` doesn't need to be set — Render injects it and the app already reads
`process.env.PORT`. First deploy has an empty database; the Pre-Deploy Command creates
the tables from `schema.prisma`, but there's no seed data — run
`npx prisma db seed` and/or `npx tsx src/db/import-leetcode.ts` once via Render's shell
(or point a local `.env` at the same Supabase project and run the importer from your
machine) to populate it.

Free-tier Render web services spin down when idle, so the first request after a while
is slow. The filesystem is also ephemeral on that tier — if `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_PDF_BUCKET` aren't set, PDF uploads fall back
to local disk under `UPLOAD_DIR` and vanish on redeploy. Set those three vars and
create the bucket in Supabase to persist uploads (bucket can be private since only
moderators fetch files by key).
