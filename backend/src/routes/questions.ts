import { Router } from 'express';
import type { QuestionStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { serializeQuestion } from '../lib/serialize.js';

export const questionsRouter = Router();

const VALID_STATUS: QuestionStatus[] = ['pending', 'approved', 'rejected'];

// GET /questions?companyId=&status=approved
questionsRouter.get('/', async (req, res) => {
  const { companyId, status } = req.query;
  const where: { companyId?: string; status?: QuestionStatus } = {};
  if (typeof companyId === 'string' && companyId) where.companyId = companyId;
  if (typeof status === 'string' && VALID_STATUS.includes(status as QuestionStatus)) {
    where.status = status as QuestionStatus;
  }
  const questions = await prisma.question.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  res.json(questions.map(serializeQuestion));
});

// GET /questions/trending — top 10 approved by upvote count (no auth needed)
questionsRouter.get('/trending', async (_req, res) => {
  const trending = await prisma.question.findMany({
    where: { status: 'approved' },
    orderBy: { upvoteCount: 'desc' },
    take: 10,
  });
  res.json(trending.map(serializeQuestion));
});

// GET /questions/:id
questionsRouter.get('/:id', async (req, res) => {
  const q = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!q) return res.status(404).json({ error: 'Question not found' });
  res.json(serializeQuestion(q));
});

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
