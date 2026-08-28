import { Router } from 'express';
import { prisma } from '../db/client.js';
import { serializeCompany } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const companiesRouter = Router();

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

// GET /companies/:slug
companiesRouter.get('/:slug', asyncHandler(async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { normalizedSlug: req.params.slug },
  });
  if (!company) return res.status(404).json({ error: 'Company not found' });
  const approved = await prisma.question.findMany({
    where: { status: 'approved', companyId: company.id },
  });
  res.json(serializeCompany(company, approved));
}));
