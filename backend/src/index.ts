import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';

import { prisma } from './db/client.js';
import { companiesRouter } from './routes/companies.js';
import { questionsRouter } from './routes/questions.js';
import { submissionsRouter } from './routes/submissions.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { requireModerator } from './middleware/requireModerator.js';
import { asyncHandler } from './lib/asyncHandler.js';

// Last-resort safety net: an unhandled rejection anywhere (e.g. outside a
// route, during startup) would otherwise crash the whole process by default
// since Node 15 — log it instead of taking the server down.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-secret'));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Public stats for homepage / moderator header.
app.get('/stats', asyncHandler(async (_req, res) => {
  const [totalApproved, totalContributors] = await Promise.all([
    prisma.question.count({ where: { status: 'approved' } }),
    prisma.user.count(),
  ]);
  res.json({ totalApproved, totalContributors });
}));

app.use('/companies', companiesRouter);
app.use('/questions', questionsRouter);
app.use('/submissions', submissionsRouter);

// Ungated auth endpoints (login/logout/session) first, then gated admin endpoints.
app.use('/admin', authRouter);
app.use('/admin', adminRouter);

// Uploaded PDFs are moderator-only.
app.use('/uploads', requireModerator, express.static(path.resolve(UPLOAD_DIR)));

// Catches errors passed via next(err) from asyncHandler — must be last, and
// must take all 4 args (that's how Express recognizes an error handler).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Request error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`CrackList backend listening on http://localhost:${PORT}`);
});
