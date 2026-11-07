import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';

// Env must be in place before the routes (and storage/pdf.ts, which reads
// UPLOAD_DIR at import time) are loaded, hence the dynamic imports below.
const uploadDir = await mkdtemp(path.join(tmpdir(), 'cracklist-test-'));
process.env.UPLOAD_DIR = uploadDir;
process.env.ADMIN_PASSWORD = 'test-password';

const { default: express } = await import('express');
const { default: cookieParser } = await import('cookie-parser');
const { prisma } = await import('../src/db/client.js');
const { questionsRouter } = await import('../src/routes/questions.js');
const { submissionsRouter } = await import('../src/routes/submissions.js');
const { authRouter } = await import('../src/routes/auth.js');
const { adminRouter } = await import('../src/routes/admin.js');

// ---- In-memory Prisma stand-in, scoped to what these routes call ----------
type Row = Record<string, any>;
let questions: Row[] = [];
let modActions: Row[] = [];
let pdfs: Row[] = [];
let users: Row[] = [];
let failNextUpdate = false;

function question(id: string, status: string): Row {
  return {
    id, status, companyId: 'c1', roleLevel: 'SDE-1', roundType: 'Tech-1', questionText: `Q ${id}`,
    codeSnippet: null, topicTags: [], askedMonthYear: null, difficulty: null, frequency: null, link: null,
    submittedByHandle: '@sub', rejectionReason: null, sourceType: 'community_submitted', sourceUrl: null,
    sourceLabel: null, intakePath: 'structured', upvoteCount: 0, perceivedEasy: 0, perceivedMedium: 0,
    perceivedHard: 0, idempotencyKey: null, createdAt: new Date('2026-10-01'),
  };
}
beforeEach(() => {
  questions = [question('approved-1', 'approved'), question('pending-1', 'pending'), question('rejected-1', 'rejected')];
  modActions = [];
  pdfs = [];
  users = [{ handle: '@sub', approvedCount: 0 }];
  failNextUpdate = false;
});

const tick = () => new Promise((r) => setTimeout(r, 15));
const questionStub = {
  // The delay lets two concurrent requests both finish their read before
  // either writes, which is exactly the interleaving the guard must survive.
  findUnique: async ({ where }: Row) => {
    await tick();
    const row = questions.find((q) => q.id === where.id);
    return row ? { ...row } : null;
  },
  findMany: async ({ where = {} }: Row) => questions.filter((q) => !where.status || q.status === where.status),
  update: async ({ where, data }: Row) => {
    if (failNextUpdate) {
      failNextUpdate = false;
      throw new Error('connection reset');
    }
    // Mirrors Prisma 5+: non-unique fields in `where` filter the UPDATE, and
    // no match throws P2025.
    const row = questions.find((q) => q.id === where.id && (!where.status || q.status === where.status));
    if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
    for (const [key, value] of Object.entries(data)) {
      row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value;
    }
    return { ...row };
  },
};
Object.assign(prisma.question, questionStub);
Object.assign(prisma.modAction, { create: async ({ data }: Row) => (modActions.push(data), data) });
Object.assign(prisma.user, {
  update: async ({ where, data }: Row) => {
    const user = users.find((u) => u.handle === where.handle)!;
    user.approvedCount += data.approvedCount.increment;
    return user;
  },
});
Object.assign(prisma.pdfSubmission, {
  findUnique: async () => null,
  create: async ({ data }: Row) => {
    const row = { id: `pdf-${pdfs.length + 1}`, createdAt: new Date(), ...data };
    pdfs.push(row);
    return row;
  },
});
// No real rollback here; the routes only write the audit row after the guarded
// update succeeds, so a throw before it leaves nothing behind either way.
Object.assign(prisma, { $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma) });

// ---- App + helpers ---------------------------------------------------------
const app = express();
app.use(express.json());
app.use(cookieParser('test-secret'));
app.use('/questions', questionsRouter);
app.use('/submissions', submissionsRouter);
app.use('/admin', authRouter);
app.use('/admin', adminRouter);
app.use((_err: Error, _req: any, res: any, _next: any) => res.status(500).json({ error: 'Internal server error' }));

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No test port');
const base = `http://127.0.0.1:${address.port}`;
after(async () => {
  server.closeAllConnections();
  server.close();
  await rm(uploadDir, { recursive: true, force: true });
});

async function call(pathname: string, init: RequestInit & { json?: unknown; cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set('Content-Type', 'application/json');
  if (init.cookie) headers.set('Cookie', init.cookie);
  const res = await fetch(base + pathname, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}
async function moderatorCookie() {
  const res = await call('/admin/login', { method: 'POST', json: { password: 'test-password' } });
  assert.equal(res.status, 200);
  return res.headers.get('set-cookie')!.split(';')[0];
}

// ---- Public reads never expose unmoderated rows ----------------------------
test('public question reads only return approved rows', async () => {
  assert.equal((await call('/questions/approved-1')).status, 200);
  assert.equal((await call('/questions/pending-1')).status, 404);
  assert.equal((await call('/questions/rejected-1')).status, 404);
  assert.equal((await call('/questions/pending-1/also-at')).status, 404);

  const listed = await call('/questions?status=pending');
  assert.deepEqual(listed.body.map((q: Row) => q.id), ['approved-1']);
});

test('moderators can still read pending rows', async () => {
  const cookie = await moderatorCookie();
  assert.equal((await call('/questions/pending-1', { cookie })).status, 200);
  const listed = await call('/questions?status=pending', { cookie });
  assert.deepEqual(listed.body.map((q: Row) => q.id), ['pending-1']);
});

test('a forged session cookie is not a moderator session', async () => {
  const forged = 'cracklist_mod=ok';
  assert.equal((await call('/questions/pending-1', { cookie: forged })).status, 404);
  assert.equal((await call('/admin/queue', { cookie: forged })).status, 401);
});

// ---- Votes only land on approved rows --------------------------------------
test('votes on non-approved rows are 404 and change nothing', async () => {
  for (const id of ['pending-1', 'rejected-1', 'missing']) {
    assert.equal((await call(`/questions/${id}/upvote`, { method: 'POST' })).status, 404);
    assert.equal(
      (await call(`/questions/${id}/difficulty-vote`, { method: 'POST', json: { difficulty: 'Hard' } })).status,
      404,
    );
    assert.equal((await call(`/questions/${id}/confirm`, { method: 'POST', json: { handle: '@x' } })).status, 404);
  }
  assert.equal(questions.find((q) => q.id === 'pending-1')!.upvoteCount, 0);

  const ok = await call('/questions/approved-1/upvote', { method: 'POST' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.upvoteCount, 1);
});

test('a database failure during a vote is a 500, not a disguised 404', async () => {
  failNextUpdate = true;
  assert.equal((await call('/questions/approved-1/upvote', { method: 'POST' })).status, 500);
});

// ---- Moderation transitions are one-shot -----------------------------------
test('approving twice is a 409 with one audit row and one credit', async () => {
  const cookie = await moderatorCookie();
  assert.equal((await call('/admin/questions/pending-1/approve', { method: 'POST', cookie, json: {} })).status, 200);
  const again = await call('/admin/questions/pending-1/approve', { method: 'POST', cookie, json: {} });
  assert.equal(again.status, 409);
  assert.equal(modActions.length, 1);
  assert.equal(users[0].approvedCount, 1);
});

test('concurrent approve and reject: exactly one wins', async () => {
  const cookie = await moderatorCookie();
  const results = await Promise.all([
    call('/admin/questions/pending-1/approve', { method: 'POST', cookie, json: {} }),
    call('/admin/questions/pending-1/reject', { method: 'POST', cookie, json: { reason: 'duplicate' } }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(modActions.length, 1);
  assert.equal(modActions[0].action, questions.find((q) => q.id === 'pending-1')!.status === 'approved' ? 'approve' : 'reject');
});

test('an already-rejected question cannot be approved', async () => {
  const cookie = await moderatorCookie();
  const res = await call('/admin/questions/rejected-1/approve', { method: 'POST', cookie, json: {} });
  assert.equal(res.status, 409);
  assert.equal(questions.find((q) => q.id === 'rejected-1')!.status, 'rejected');
  assert.equal(modActions.length, 0);
});

// ---- Uploads keep the real bytes and type ----------------------------------
test('PDF upload stores the real file and its type', async () => {
  const bytes = Buffer.from('%PDF-1.7 real contents');
  const form = new FormData();
  form.set('email', 'a@b.co');
  form.set('file', new Blob([bytes], { type: 'application/pdf' }), 'drive-notes.pdf');
  const res = await call('/submissions/pdf', { method: 'POST', body: form });
  assert.equal(res.status, 201);
  assert.equal(pdfs[0].contentType, 'application/pdf');
  assert.deepEqual(await readFile(path.join(uploadDir, pdfs[0].storageKey)), bytes);
});

test('uploads that are not a PDF or image are 415', async () => {
  const form = new FormData();
  form.set('email', 'a@b.co');
  form.set('file', new Blob(['<script>'], { type: 'text/html' }), 'x.html');
  const res = await call('/submissions/pdf', { method: 'POST', body: form });
  assert.equal(res.status, 415);
  assert.equal(pdfs.length, 0);
});

test('wrong moderator password is rejected', async () => {
  assert.equal((await call('/admin/login', { method: 'POST', json: { password: 'nope' } })).status, 401);
  assert.equal((await call('/admin/login', { method: 'POST', json: { password: 'test-passwordX' } })).status, 401);
});
