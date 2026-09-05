import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/client.js';
import {
  QUESTION_LIST_SELECT,
  serializeCompany,
  serializeQuestionListItem,
} from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const companiesRouter = Router();

const LIST_DEFAULT_LIMIT = 40;
const LIST_MAX_LIMIT = 100;

function readIds(value: unknown): string[] | null {
  return Array.isArray(value) && value.length <= 20000 && value.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 128)
    ? [...new Set(value)] : null;
}

// Read-only POST keeps device-local question IDs out of URLs and access logs.
companiesRouter.post('/:slug/progress', asyncHandler(async (req, res) => {
  const ids = readIds(req.body?.ids);
  if (!ids) return res.status(400).json({ error: 'Expected an array of question IDs' });
  const rows = await prisma.question.findMany({
    where: { company: { normalizedSlug: req.params.slug }, status: 'approved', id: { in: ids } },
    select: { id: true },
  });
  res.json({ ids: rows.map((row) => row.id) });
}));

// GET /companies -> list for the homepage grid. Only questionCount is needed
// there, so compute it via a single groupBy instead of loading all 17k+
// approved questions into Node and filtering per company in JS (was ~7s;
// the full per-company breakdown lives on GET /companies/:slug instead).
companiesRouter.get('/', asyncHandler(async (_req, res) => {
  const [companies, counts] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: 'asc' } }),
    prisma.question.groupBy({
      by: ['companyId'],
      where: { status: 'approved' },
      _count: { _all: true },
    }),
  ]);
  const countByCompany = new Map(counts.map((c) => [c.companyId, c._count._all]));
  res.json(
    companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.normalizedSlug,
      logoUrl: c.logoUrl,
      questionCount: countByCompany.get(c.id) ?? 0,
      contributorCount: 0,
      mostActiveRole: 'Other',
      mostRecent: null,
    })),
  );
}));

// GET /companies/:slug — header stats only.
// Every figure here is an aggregate, so it's computed with GROUP BY in
// Postgres rather than by pulling the company's approved rows into Node.
// The old version loaded every full row (question text, code snippets and
// all) purely to count distinct handles, which meant opening one company
// page fetched its entire question set twice over.
companiesRouter.get('/:slug', asyncHandler(async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { normalizedSlug: req.params.slug },
  });
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const where = { status: 'approved' as const, companyId: company.id };
  const [roleCounts, contributorRows, monthRows] = await Promise.all([
    prisma.question.groupBy({ by: ['roleLevel'], where, _count: { _all: true } }),
    prisma.question.groupBy({ by: ['submittedByHandle'], where }),
    prisma.question.groupBy({ by: ['askedMonthYear'], where }),
  ]);

  res.json(
    serializeCompany(company, {
      // Sum of the per-role buckets — the same number COUNT(*) would give,
      // without a fourth round trip for it.
      questionCount: roleCounts.reduce((n, r) => n + r._count._all, 0),
      roleCounts: roleCounts.map((r) => ({ roleLevel: r.roleLevel, count: r._count._all })),
      contributorHandles: contributorRows.map((r) => r.submittedByHandle),
      askedMonths: monthRows.map((r) => r.askedMonthYear),
    }),
  );
}));

// GET /companies/:slug/questions?role=&round=&difficulty=&q=&limit=&offset=
//
// The company question table used to be built by fetching every approved
// question for the company and filtering, counting and slicing it in the
// browser. Amazon alone is thousands of full rows, sent so the client could
// display forty of them. Filtering and paging now happen in Postgres, and
// only the nine columns the table actually renders come back.
const listQuestions = asyncHandler(async (req: Request, res: Response) => {
  const ids = req.method === 'POST' ? readIds(req.body?.ids) : undefined;
  if (ids === null) return res.status(400).json({ error: 'Expected an array of question IDs' });
  const company = await prisma.company.findUnique({
    where: { normalizedSlug: req.params.slug },
    select: { id: true },
  });
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const role = str(req.query.role);
  const round = str(req.query.round);
  const difficulty = str(req.query.difficulty);
  const q = str(req.query.q)?.trim();
  const rawLimit = Number(req.query.limit ?? LIST_DEFAULT_LIMIT);
  const rawOffset = Number(req.query.offset ?? 0);
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || !Number.isSafeInteger(rawOffset) || rawOffset < 0) {
    return res.status(400).json({ error: 'Limit and offset must be valid whole numbers' });
  }
  const limit = Math.min(LIST_MAX_LIMIT, rawLimit);
  const offset = rawOffset;

  const base = { status: 'approved' as const, companyId: company.id };

  // The UI's round filter is coarser than the stored value: "Phone" means the
  // phone screen, "Tech" means any of the numbered technical rounds.
  const roundWhere =
    round === 'Phone'
      ? { roundType: 'Phone screen' }
      : round === 'Tech'
        ? { roundType: { in: ['Tech-1', 'Tech-2', 'Tech-3'] } }
        : round
          ? { roundType: round }
          : {};

  const where = {
    ...base,
    ...(ids ? { id: { in: ids } } : {}),
    ...(role ? { roleLevel: role } : {}),
    ...roundWhere,
    ...(difficulty ? { difficulty } : {}),
    ...(q
      ? {
          OR: [
            { questionText: { contains: q, mode: 'insensitive' as const } },
            { topicTags: { has: q } },
          ],
        }
      : {}),
  };

  const [rows, total, totalUnfiltered, indexedCount] = await Promise.all([
    prisma.question.findMany({
      where,
      select: QUESTION_LIST_SELECT,
      // createdAt alone is not a stable sort key: bulk-imported rows share a
      // timestamp, and ties reorder between queries, which makes offset paging
      // skip and repeat rows. id breaks the tie deterministically.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit,
      skip: offset,
    }),
    prisma.question.count({ where }),
    prisma.question.count({ where: base }),
    // Drives which filter set the table offers: indexed rows are filtered by
    // difficulty, community rows by role and round. Must reflect the whole
    // company, not the current page.
    prisma.question.count({ where: { ...base, difficulty: { not: null } } }),
  ]);

  res.json({
    items: rows.map(serializeQuestionListItem),
    total,
    totalUnfiltered,
    hasIndexed: indexedCount > 0,
  });
});
companiesRouter.get('/:slug/questions', listQuestions);
companiesRouter.post('/:slug/questions', listQuestions);
