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
app.get('/stats', async (_req, res) => {
  const [totalApproved, totalContributors] = await Promise.all([
    prisma.question.count({ where: { status: 'approved' } }),
    prisma.user.count(),
  ]);
  res.json({ totalApproved, totalContributors });
});

app.use('/companies', companiesRouter);
app.use('/questions', questionsRouter);
app.use('/submissions', submissionsRouter);

// Ungated auth endpoints (login/logout/session) first, then gated admin endpoints.
app.use('/admin', authRouter);
app.use('/admin', adminRouter);

// Uploaded PDFs are moderator-only.
app.use('/uploads', requireModerator, express.static(path.resolve(UPLOAD_DIR)));

app.listen(PORT, () => {
  console.log(`Askd backend listening on http://localhost:${PORT}`);
});
