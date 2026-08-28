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
cp .env.example .env          # set DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
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

## Deploying the frontend (Cloudflare Pages)

This is a monorepo — Cloudflare's defaults assume the app lives at the repo root,
which it doesn't here. In the Pages project settings, set:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `VITE_API_URL` = your deployed backend's public URL |

Without `VITE_API_URL` set, the deployed site calls `http://localhost:4000` from the
visitor's browser and every request fails — the page loads but shows 0 companies/questions.

`frontend/public/_redirects` (`/* /index.html 200`) is already in the repo — required
for React Router's client-side routes (`/c/:slug`, `/q/:id`, etc.) to not 404 on
direct load or refresh. `frontend/.nvmrc` pins Node 22 (Vite 8 needs 20.19+; Cloudflare's
older default Node fails the build).

**The backend can't deploy to Cloudflare Pages** — it's static hosting only, and this is
a stateful Express + Postgres API. Deploy `backend/` separately (Railway, Render, Fly.io,
or a VPS), then point `VITE_API_URL` at that URL.
