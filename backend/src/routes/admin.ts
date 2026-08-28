import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireModerator } from '../middleware/requireModerator.js';
import { serializeQuestion } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const adminRouter = Router();

// Every route here requires a moderator session.
adminRouter.use(requireModerator);

// GET /admin/queue -> pending questions (the moderation queue)
adminRouter.get('/queue', asyncHandler(async (_req, res) => {
  const pending = await prisma.question.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(pending.map(serializeQuestion));
}));

// GET /admin/pdf-inbox -> Path 2 submissions awaiting manual extraction
adminRouter.get('/pdf-inbox', asyncHandler(async (_req, res) => {
  const inbox = await prisma.pdfSubmission.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(
    inbox.map((s) => ({
      id: s.id,
      email: s.email,
      filename: s.filename,
      note: s.note,
      createdAt: s.createdAt.toISOString(),
    })),
  );
}));

// POST /admin/questions/:id/approve -> question goes live
adminRouter.post('/questions/:id/approve', asyncHandler(async (req, res) => {
  const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Question not found' });

  const q = await prisma.question.update({
    where: { id: req.params.id },
    data: { status: 'approved', rejectionReason: null },
  });

  // Credit the submitter's approved_count.
  if (q.submittedByHandle) {
    await prisma.user.update({
      where: { handle: q.submittedByHandle },
      data: { approvedCount: { increment: 1 } },
    }).catch(() => undefined);
  }

  res.json(serializeQuestion(q));
}));

// POST /admin/questions/:id/reject { reason }
adminRouter.post('/questions/:id/reject', asyncHandler(async (req, res) => {
  const { reason } = req.body ?? {};
  if (typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'reason is required' });
  }
  const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Question not found' });

  const q = await prisma.question.update({
    where: { id: req.params.id },
    data: { status: 'rejected', rejectionReason: reason },
  });
  res.json(serializeQuestion(q));
}));
