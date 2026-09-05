import express from 'express';
import { prisma } from '../../src/db/client.js';
import { companiesRouter } from '../../src/routes/companies.js';

// Deliberately synthetic data. Never imported by the application or database seed.
const names = [
  'Two Sum',
  'Longest Substring Without Repeating Characters',
  'Merge Intervals',
  'Course Schedule',
  'Binary Tree Level Order Traversal',
  'Coin Change',
  'Search in Rotated Sorted Array',
  'LRU Cache',
  'Word Ladder',
  'Valid Parentheses',
  'Number of Islands',
  'Median of Two Sorted Arrays',
];
export const companies = [
  { id: 'preview-google', normalizedSlug: 'google', name: 'Google', logoUrl: null },
  { id: 'preview-stripe', normalizedSlug: 'stripe', name: 'Stripe', logoUrl: null },
  { id: 'preview-empty', normalizedSlug: 'empty', name: 'Empty Company', logoUrl: null },
];
export const questions = Array.from({ length: 104 }, (_, index) => ({
  id: `preview-question-${index + 1}`,
  companyId: index < 96 ? 'preview-google' : 'preview-stripe',
  questionText:
    names[index % names.length] + (index >= 12 ? ` · variation ${Math.floor(index / 12) + 1}` : ''),
  difficulty: index < 96 ? ['Easy', 'Medium', 'Hard'][index % 3] : null,
  roleLevel: 'SDE-1',
  roundType: 'Tech-1',
  status: 'approved',
  topicTags: [
    ['Array', 'Hash Table'],
    ['String', 'Sliding Window'],
    ['Array', 'Sorting'],
    ['Graph', 'Topological Sort'],
  ][index % 4],
  sourceType: index < 96 ? 'indexed' : 'community_submitted',
  frequency: null,
  upvoteCount: index % 9,
  askedMonthYear: index < 96 ? null : '2026-08',
  submittedByHandle: index < 96 ? null : '@preview',
  createdAt: new Date('2026-09-01'),
}));

type Where = Record<string, any>;
function matches(row: (typeof questions)[number], where: Where = {}): boolean {
  if (where.companyId && row.companyId !== where.companyId) return false;
  if (
    where.company &&
    companies.find((company) => company.id === row.companyId)?.normalizedSlug !== where.company.normalizedSlug
  )
    return false;
  if (where.id && !where.id.in.includes(row.id)) return false;
  if (where.status && row.status !== where.status) return false;
  if (typeof where.difficulty === 'string' && row.difficulty !== where.difficulty) return false;
  if (where.difficulty?.not === null && row.difficulty === null) return false;
  if (where.roleLevel && row.roleLevel !== where.roleLevel) return false;
  if (typeof where.roundType === 'string' && row.roundType !== where.roundType) return false;
  if (where.roundType?.in && !where.roundType.in.includes(row.roundType)) return false;
  if (
    where.OR &&
    !where.OR.some((part: Where) =>
      part.questionText
        ? row.questionText.toLowerCase().includes(part.questionText.contains.toLowerCase())
        : row.topicTags.includes(part.topicTags.has),
    )
  )
    return false;
  return true;
}

export function fixtureApp() {
  Object.assign(prisma.company, {
    findUnique: async ({ where }: Where) =>
      companies.find((company) => company.normalizedSlug === where.normalizedSlug) ?? null,
    findMany: async () => companies,
  });
  Object.assign(prisma.question, {
    findMany: async ({ where, skip = 0, take }: Where) =>
      questions
        .filter((row) => matches(row, where))
        .slice(skip, take === undefined ? undefined : skip + take),
    count: async ({ where }: Where) => questions.filter((row) => matches(row, where)).length,
    groupBy: async ({ where, by }: Where) => {
      const buckets = new Map<string, any>();
      for (const row of questions.filter((row) => matches(row, where))) {
        const key = by[0] as keyof typeof row;
        const value = row[key];
        const previous = buckets.get(String(value));
        if (previous) previous._count._all++;
        else buckets.set(String(value), { [key]: value, _count: { _all: 1 } });
      }
      return [...buckets.values()];
    },
  });
  const app = express();
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5174');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (_req.method === 'OPTIONS') return void res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '3mb' }));
  // Delays expose loading transitions and pagination races in the browser.
  app.use('/companies/:slug/questions', (req, _res, next) => {
    setTimeout(next, req.query.offset ? 900 : 400);
  });
  app.get('/admin/session', (_req, res) => res.json({ authenticated: false }));
  app.get('/stats', (_req, res) => res.json({ totalApproved: questions.length, totalContributors: 1 }));
  app.use('/companies', companiesRouter);
  const full = (row: (typeof questions)[number]) => ({
    ...row,
    sourceType: row.sourceType === 'indexed' ? 'indexed' : 'community-submitted',
    codeSnippet: null,
    link: row.sourceType === 'indexed' ? 'https://leetcode.com/problemset/' : null,
    sourceUrl: '',
    sourceLabel: 'Preview fixture',
    perceivedEasy: 0,
    perceivedMedium: 0,
    perceivedHard: 0,
    submittedBy: row.submittedByHandle,
    intakePath: null,
    rejectionReason: null,
  });
  app.get(['/questions/trending', '/questions/recent', '/questions/search'], (req, res) =>
    res.json(
      questions
        .filter(
          (row) => !req.query.q || row.questionText.toLowerCase().includes(String(req.query.q).toLowerCase()),
        )
        .slice(0, 8)
        .map(full),
    ),
  );
  app.get('/questions/:id/also-at', (_req, res) => res.json([]));
  app.get('/questions/:id', (req, res) => {
    const row = questions.find((question) => question.id === req.params.id);
    if (!row) return void res.status(404).json({ error: 'Question not found' });
    res.json(full(row));
  });
  app.post('/questions/:id/confirm', (_req, res) =>
    res.status(503).json({ error: 'Preview: confirmation is unavailable' }),
  );
  app.post('/questions/:id/difficulty-vote', (_req, res) =>
    res.status(503).json({ error: 'Preview: voting is unavailable' }),
  );
  return app;
}
