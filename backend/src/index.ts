import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
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

// The session cookie's only protection is its HMAC signature. Falling back to
// a hardcoded secret in production would let anyone who has read this repo
// mint a moderator cookie, so refuse to boot instead.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set in production');
}

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());

// Render sits behind a reverse proxy; without this express-rate-limit sees
// every request as coming from the proxy IP and either counts the whole
// planet as one bucket or refuses to start. Trusting one proxy hop is the
// right level — trusting all would let a spoofed X-Forwarded-For bypass
// the limit.
app.set('trust proxy', 1);

app.use(cors({ origin: origins, credentials: true }));
// Device progress can contain many IDs; other JSON endpoints keep the default limit.
app.use('/companies', express.json({ limit: '3mb' }));
app.use(express.json());
app.use(cookieParser(SESSION_SECRET || 'dev-secret'));

// Rate limits public write endpoints so a scripted loop can't bury the
// moderation queue. Numbers are conservative — a human submitting a real
// question won't come near them, an abuser hits the wall fast.
const submissionsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many submissions — please try again in a few minutes.' },
});

// One shared moderator password means one brute-force target. Only failed
// attempts count, so a moderator who logs in correctly never trips it.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again in 15 minutes.' },
});

// Upvotes, confirmations and difficulty votes are anonymous counters, and
// trending ranks by them. Without a cap one curl loop owns the homepage.
// Deliberately loose: campus Wi-Fi puts a whole hostel behind one NAT IP, and
// a per-IP limit tight enough to stop a script would also lock out real
// students voting at the same time. Reads are never limited.
const votesLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 100,
  skip: (req) => req.method !== 'POST',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many votes from this network — please slow down.' },
});

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
app.use('/questions', votesLimiter, questionsRouter);
app.use('/submissions', submissionsLimiter, submissionsRouter);

// Ungated auth endpoints (login/logout/session) first, then gated admin endpoints.
app.use('/admin/login', loginLimiter);
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
