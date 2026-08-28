import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db/client.js';
import { serializeQuestion } from '../lib/serialize.js';
import { savePdf } from '../storage/pdf.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const submissionsRouter = Router();

// Prisma's typed error code for unique-constraint violation. The client
// sends an Idempotency-Key header; if the second request with the same
// key races the first past the initial lookup, the DB's unique index
// catches it and we return the row already committed.
const PRISMA_UNIQUE_VIOLATION = 'P2002';
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === PRISMA_UNIQUE_VIOLATION
  );
}

function idempotencyKeyOf(req: import('express').Request): string | null {
  const raw = req.header('idempotency-key');
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Bound the key so a hostile client can't stuff a 10MB header into a
  // unique index. UUID length + slack is plenty.
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  return trimmed;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

// POST /submissions/structured -> creates a pending question
// body: { handle, email, companySlug, roleLevel, roundType, title, askedMonthYear, sourceUrl, tags[] }
submissionsRouter.post('/structured', asyncHandler(async (req, res) => {
  const {
    handle,
    email,
    companySlug,
    roleLevel,
    roundType,
    title,
    askedMonthYear,
    sourceUrl,
    tags,
  } = req.body ?? {};

  if (!companySlug || !title || !roleLevel || !roundType) {
    return res.status(400).json({ error: 'companySlug, title, roleLevel and roundType are required' });
  }

  const idempotencyKey = idempotencyKeyOf(req);
  if (idempotencyKey) {
    const existing = await prisma.question.findUnique({ where: { idempotencyKey } });
    if (existing) return res.status(200).json(serializeQuestion(existing));
  }

  const company = await prisma.company.findUnique({ where: { normalizedSlug: companySlug } });
  if (!company) return res.status(400).json({ error: `Unknown company: ${companySlug}` });

  // Upsert the submitting user (handle is the identity), bump submission_count.
  let submittedByHandle: string | null = null;
  if (typeof handle === 'string' && handle.trim()) {
    const user = await prisma.user.upsert({
      where: { handle },
      update: { submissionCount: { increment: 1 }, email: email || undefined },
      create: { handle, email: email || null, submissionCount: 1 },
    });
    submittedByHandle = user.handle;
  }

  const topicTags = Array.isArray(tags)
    ? tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : [];

  try {
    const question = await prisma.question.create({
      data: {
        companyId: company.id,
        roleLevel,
        roundType,
        questionText: title,
        topicTags,
        askedMonthYear: askedMonthYear || null,
        submittedByHandle,
        status: 'pending',
        sourceType: 'community_submitted',
        sourceUrl: sourceUrl || null,
        sourceLabel: submittedByHandle ? `via ${submittedByHandle}` : 'via community submission',
        intakePath: 'structured',
        idempotencyKey,
      },
    });
    res.status(201).json(serializeQuestion(question));
  } catch (e) {
    // Race: another request with the same idempotency key beat us to the
    // insert between our lookup and our write. Return the row it created.
    if (idempotencyKey && isUniqueViolation(e)) {
      const existing = await prisma.question.findUnique({ where: { idempotencyKey } });
      if (existing) return res.status(200).json(serializeQuestion(existing));
    }
    throw e;
  }
}));

// POST /submissions/pdf (multipart: email, file, note)
// Saves the file via the storage interface and records a pdf_submissions row.
// These never auto-become questions — a moderator creates one manually if approved.
submissionsRouter.post('/pdf', upload.single('file'), asyncHandler(async (req, res) => {
  const { email, note } = req.body ?? {};
  const file = req.file;
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }
  if (!file) return res.status(400).json({ error: 'file is required' });

  const idempotencyKey = idempotencyKeyOf(req);
  if (idempotencyKey) {
    const existing = await prisma.pdfSubmission.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return res.status(200).json({
        id: existing.id,
        email: existing.email,
        filename: existing.filename,
        note: existing.note,
        createdAt: existing.createdAt.toISOString(),
      });
    }
  }

  const saved = await savePdf(file.originalname, file.buffer);

  try {
    const submission = await prisma.pdfSubmission.create({
      data: {
        email,
        filename: file.originalname,
        note: typeof note === 'string' ? note : '',
        storageKey: saved.key,
        idempotencyKey,
      },
    });
    res.status(201).json({
      id: submission.id,
      email: submission.email,
      filename: submission.filename,
      note: submission.note,
      createdAt: submission.createdAt.toISOString(),
    });
  } catch (e) {
    if (idempotencyKey && isUniqueViolation(e)) {
      const existing = await prisma.pdfSubmission.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return res.status(200).json({
          id: existing.id,
          email: existing.email,
          filename: existing.filename,
          note: existing.note,
          createdAt: existing.createdAt.toISOString(),
        });
      }
    }
    throw e;
  }
}));
