import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireModerator } from '../middleware/requireModerator.js';
import { serializeQuestion } from '../lib/serialize.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { readPdf } from '../storage/pdf.js';
import { isRecordNotFound } from '../lib/prismaErrors.js';

export const adminRouter = Router();

// Cap fields going into the audit trail so a hostile client can't stuff a
// 10MB user-agent into an indexed column.
function actorOf(req: Request): string {
  const raw = typeof req.body?.moderator === 'string' ? req.body.moderator.trim() : '';
  return raw.length > 0 && raw.length <= 80 ? raw : 'moderator';
}
function userAgentOf(req: Request): string | null {
  const ua = req.header('user-agent');
  if (!ua) return null;
  return ua.length > 240 ? ua.slice(0, 240) : ua;
}

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
      // hasFile lets the UI show a download link only when a key exists —
      // older rows submitted before storageKey was captured won't have one.
      hasFile: Boolean(s.storageKey),
      createdAt: s.createdAt.toISOString(),
    })),
  );
}));

// GET /admin/pdf-inbox/:id/download -> stream the raw PDF back through the
// backend. Proxied so moderators don't need Supabase console access, and so
// the service_role key never leaves the server.
adminRouter.get('/pdf-inbox/:id/download', asyncHandler(async (req, res) => {
  const submission = await prisma.pdfSubmission.findUnique({ where: { id: req.params.id } });
  if (!submission || !submission.storageKey) {
    return res.status(404).json({ error: 'PDF not found' });
  }
  try {
    const buf = await readPdf(submission.storageKey);
    res.setHeader('Content-Type', submission.contentType ?? 'application/pdf');
    // Uploaded content is attacker-controlled: stop the browser sniffing an
    // "image" into HTML. The filename is reduced to printable ASCII because
    // setHeader throws on anything else (a Hindi filename used to 502 here).
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const safeName = submission.filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.send(buf);
  } catch (e) {
    console.error('PDF read failed:', e);
    res.status(502).json({ error: 'Could not fetch the file from storage' });
  }
}));

// Moderation transitions only fire from `pending`. The status check lives in
// the UPDATE's WHERE clause, not in a prior read, so two moderators (or one
// double-click) racing on the same row can't both win: Postgres serialises
// the two UPDATEs on the row lock, the second re-evaluates `status = pending`
// after the first commits, matches nothing, and Prisma throws P2025. The
// transaction then rolls back before any audit row or counter bump is written.
class NotPending extends Error {}
async function transition<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (isRecordNotFound(e)) throw new NotPending();
    throw e;
  }
}
function notPending(res: Response, status: string) {
  return res.status(409).json({ error: `Question is already ${status}` });
}

// POST /admin/questions/:id/approve -> question goes live
adminRouter.post('/questions/:id/approve', asyncHandler(async (req, res) => {
  const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Question not found' });
  // Fast path for the common case (a stale queue tab). The guarded UPDATE
  // below is what actually enforces it under concurrency.
  if (existing.status !== 'pending') return notPending(res, existing.status);

  let q;
  try {
    // Status change + audit row go through in one transaction: if either
    // fails we don't want half the state committed.
    q = await prisma.$transaction(async (tx) => {
      const updated = await transition(() =>
        tx.question.update({
          where: { id: req.params.id, status: 'pending' },
          data: { status: 'approved', rejectionReason: null },
        }),
      );
      await tx.modAction.create({
        data: {
          actor: actorOf(req),
          action: 'approve',
          targetType: 'question',
          targetId: updated.id,
          beforeStatus: 'pending',
          afterStatus: updated.status,
          userAgent: userAgentOf(req),
        },
      });
      return updated;
    });
  } catch (e) {
    if (e instanceof NotPending) return notPending(res, 'moderated');
    throw e;
  }

  // Credit the submitter's approved_count — outside the txn on purpose.
  // If the user row is gone the audit trail stays intact. The guarded
  // transition above guarantees this runs at most once per question.
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
  if (existing.status !== 'pending') return notPending(res, existing.status);

  let q;
  try {
    q = await prisma.$transaction(async (tx) => {
      const updated = await transition(() =>
        tx.question.update({
          where: { id: req.params.id, status: 'pending' },
          data: { status: 'rejected', rejectionReason: reason },
        }),
      );
      await tx.modAction.create({
        data: {
          actor: actorOf(req),
          action: 'reject',
          targetType: 'question',
          targetId: updated.id,
          beforeStatus: 'pending',
          afterStatus: updated.status,
          reason,
          userAgent: userAgentOf(req),
        },
      });
      return updated;
    });
  } catch (e) {
    if (e instanceof NotPending) return notPending(res, 'moderated');
    throw e;
  }
  res.json(serializeQuestion(q));
}));

// GET /admin/mod-actions?limit=50 -> recent audit trail entries.
// Also includes the current question title/company slug so the UI can
// render a useful row without a second lookup per action.
adminRouter.get('/mod-actions', asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const actions = await prisma.modAction.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const questionIds = actions.filter((a) => a.targetType === 'question').map((a) => a.targetId);
  const questions = questionIds.length
    ? await prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, questionText: true, company: { select: { name: true, normalizedSlug: true } } },
      })
    : [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  res.json(
    actions.map((a) => {
      const q = byId.get(a.targetId);
      return {
        id: a.id,
        actor: a.actor,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        targetTitle: q?.questionText ?? null,
        targetCompanyName: q?.company?.name ?? null,
        targetCompanySlug: q?.company?.normalizedSlug ?? null,
        beforeStatus: a.beforeStatus,
        afterStatus: a.afterStatus,
        reason: a.reason,
        userAgent: a.userAgent,
        createdAt: a.createdAt.toISOString(),
      };
    }),
  );
}));
