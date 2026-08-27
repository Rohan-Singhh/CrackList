import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db/client.js';
import { serializeQuestion } from '../lib/serialize.js';
import { savePdf } from '../storage/pdf.js';

export const submissionsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

// POST /submissions/structured -> creates a pending question
// body: { handle, email, companySlug, roleLevel, roundType, title, askedMonthYear, sourceUrl, tags[] }
submissionsRouter.post('/structured', async (req, res) => {
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
    },
  });

  res.status(201).json(serializeQuestion(question));
});

// POST /submissions/pdf (multipart: email, file, note)
// Saves the file via the storage interface and records a pdf_submissions row.
// These never auto-become questions — a moderator creates one manually if approved.
submissionsRouter.post('/pdf', upload.single('file'), async (req, res) => {
  const { email, note } = req.body ?? {};
  const file = req.file;
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }
  if (!file) return res.status(400).json({ error: 'file is required' });

  await savePdf(file.originalname, file.buffer);

  const submission = await prisma.pdfSubmission.create({
    data: {
      email,
      filename: file.originalname,
      note: typeof note === 'string' ? note : '',
    },
  });

  res.status(201).json({
    id: submission.id,
    email: submission.email,
    filename: submission.filename,
    note: submission.note,
    createdAt: submission.createdAt.toISOString(),
  });
});
