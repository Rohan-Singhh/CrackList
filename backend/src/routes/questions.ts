import { Router } from 'express';
import type { QuestionStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { serializeQuestion } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const questionsRouter = Router();

const VALID_STATUS: QuestionStatus[] = ['pending', 'approved', 'rejected'];

// GET /questions?companyId=&status=approved&limit=&offset=
//
// Paged. This route returns whole rows, so leaving it unbounded meant a single
// request could ask Postgres for 17k+ of them and stream the lot — the company
// page used to do exactly that. `limit` defaults to 100 and is capped at 200;
// the frontend's own company listing uses GET /companies/:slug/questions, which
// filters server-side and returns only the columns its table renders.
questionsRouter.get('/', asyncHandler(async (req, res) => {
  const { companyId, status } = req.query;
  const where: { companyId?: string; status?: QuestionStatus } = {};
  if (typeof companyId === 'string' && companyId) where.companyId = companyId;
  if (typeof status === 'string' && VALID_STATUS.includes(status as QuestionStatus)) {
    where.status = status as QuestionStatus;
  }
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const questions = await prisma.question.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: limit,
    skip: offset,
  });
  res.json(questions.map(serializeQuestion));
}));

// GET /questions/trending — top 10 approved by upvote count (no auth needed)
questionsRouter.get('/trending', asyncHandler(async (_req, res) => {
  const trending = await prisma.question.findMany({
    where: { status: 'approved' },
    orderBy: { upvoteCount: 'desc' },
    take: 10,
  });
  res.json(trending.map(serializeQuestion));
}));

// GET /questions/recent?limit=6 — most recently approved (homepage cards).
// Avoids the frontend having to fetch every approved question just to sort
// and slice the top few client-side.
questionsRouter.get('/recent', asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 6));
  const recent = await prisma.question.findMany({
    where: { status: 'approved' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(recent.map(serializeQuestion));
}));

// GET /questions/search?q=&role=&limit= — server-side search so the browser
// never has to hold all 17k+ approved questions just to power a search box.
questionsRouter.get('/search', asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role : undefined;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 200));
  if (!q) return res.json([]);

  const results = await prisma.question.findMany({
    where: {
      status: 'approved',
      ...(role ? { roleLevel: { in: role.split(',') } } : {}),
      OR: [
        { questionText: { contains: q, mode: 'insensitive' } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
        { topicTags: { has: q } },
      ],
    },
    orderBy: { upvoteCount: 'desc' },
    take: limit,
  });
  res.json(results.map(serializeQuestion));
}));

// GET /questions/sitemap-data — every approved question's minimal
// SEO-relevant fields in one query, for the build-time prerender script.
// Not used by the running frontend; deliberately separate from GET /questions
// (which returns the full row for every field) to keep the build-time
// payload small even at 17k+ rows.
questionsRouter.get('/sitemap-data', asyncHandler(async (_req, res) => {
  const questions = await prisma.question.findMany({
    where: { status: 'approved' },
    select: {
      id: true,
      questionText: true,
      difficulty: true,
      roleLevel: true,
      roundType: true,
      createdAt: true,
      company: { select: { name: true, normalizedSlug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      difficulty: q.difficulty,
      roleLevel: q.roleLevel,
      roundType: q.roundType,
      createdAt: q.createdAt.toISOString(),
      companyName: q.company.name,
      companySlug: q.company.normalizedSlug,
    })),
  );
}));

// GET /questions/:id
questionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const q = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!q) return res.status(404).json({ error: 'Question not found' });
  res.json(serializeQuestion(q));
}));

// GET /questions/:id/also-at
// Companies that also ask the same underlying problem. For indexed rows
// we join on `link` (the LeetCode URL uniquely identifies the problem).
// For community rows we fall back to matching by lowercased title — good
// enough to catch "Two Sum" phrased two different ways for now. Excludes
// the current row itself from the result set. Order by company name so
// the caller doesn't have to.
questionsRouter.get('/:id/also-at', asyncHandler(async (req, res) => {
  const q = await prisma.question.findUnique({
    where: { id: req.params.id },
    select: { id: true, link: true, questionText: true, sourceType: true },
  });
  if (!q) return res.status(404).json({ error: 'Question not found' });

  const where = q.link
    ? { link: q.link, status: 'approved' as const, id: { not: q.id } }
    : {
        // Community-side title match — case-insensitive equality, not fuzzy.
        questionText: { equals: q.questionText, mode: 'insensitive' as const },
        status: 'approved' as const,
        id: { not: q.id },
      };
  const others = await prisma.question.findMany({
    where,
    select: {
      id: true,
      company: { select: { name: true, normalizedSlug: true } },
    },
    orderBy: { company: { name: 'asc' } },
    take: 200,
  });
  res.json(
    others.map((o) => ({
      questionId: o.id,
      companyName: o.company.name,
      companySlug: o.company.normalizedSlug,
    })),
  );
}));

// POST /questions/:id/upvote
questionsRouter.post('/:id/upvote', async (req, res) => {
  try {
    const q = await prisma.question.update({
      where: { id: req.params.id },
      data: { upvoteCount: { increment: 1 } },
    });
    res.json(serializeQuestion(q));
  } catch {
    res.status(404).json({ error: 'Question not found' });
  }
});

// POST /questions/:id/difficulty-vote { difficulty }
// Community-perceived-difficulty vote. Increments one of three counters
// on the row; the "consensus vs LC label" comparison is derived on the
// client from the returned counts.
const DIFFICULTY_COL = {
  Easy: 'perceivedEasy',
  Medium: 'perceivedMedium',
  Hard: 'perceivedHard',
} as const;
questionsRouter.post('/:id/difficulty-vote', asyncHandler(async (req, res) => {
  const { difficulty } = req.body ?? {};
  if (difficulty !== 'Easy' && difficulty !== 'Medium' && difficulty !== 'Hard') {
    return res.status(400).json({ error: 'difficulty must be Easy, Medium, or Hard' });
  }
  const col = DIFFICULTY_COL[difficulty as keyof typeof DIFFICULTY_COL];
  try {
    const q = await prisma.question.update({
      where: { id: req.params.id },
      data: { [col]: { increment: 1 } },
    });
    res.json(serializeQuestion(q));
  } catch {
    res.status(404).json({ error: 'Question not found' });
  }
}));

// POST /questions/:id/confirm { handle }
// A confirmation is a lightweight "I was asked this too" signal; per the PRD it
// bumps the upvote count (there is no separate confirmations table).
questionsRouter.post('/:id/confirm', async (req, res) => {
  const { handle } = req.body ?? {};
  if (typeof handle !== 'string' || !handle.trim()) {
    return res.status(400).json({ error: 'handle is required' });
  }
  try {
    const q = await prisma.question.update({
      where: { id: req.params.id },
      data: { upvoteCount: { increment: 1 } },
    });
    res.json(serializeQuestion(q));
  } catch {
    res.status(404).json({ error: 'Question not found' });
  }
});
