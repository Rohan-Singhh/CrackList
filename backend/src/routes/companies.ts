import { Router } from 'express';
import { prisma } from '../db/client.js';
import { serializeCompany } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const companiesRouter = Router();

// GET /companies -> list with computed stats (question/contributor counts, etc.)
companiesRouter.get('/', asyncHandler(async (_req, res) => {
  const [companies, approved] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: 'asc' } }),
    prisma.question.findMany({ where: { status: 'approved' } }),
  ]);
  res.json(companies.map((c) => serializeCompany(c, approved)));
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
