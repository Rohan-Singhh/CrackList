import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fixtureApp } from './fixtures/library.js';

const server = fixtureApp().listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No test port');
const base = `http://127.0.0.1:${address.port}`;
after(() => {
  server.closeAllConnections();
  server.close();
});
const read = async (path: string, body?: unknown) => {
  const response = await fetch(
    base + path,
    body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {},
  );
  return { status: response.status, body: await response.json() };
};

test('company pages are bounded and do not repeat rows between offsets', async () => {
  const first = await read('/companies/google/questions');
  const second = await read('/companies/google/questions?offset=40');
  assert.equal(first.body.items.length, 40);
  assert.equal(first.body.total, 96);
  assert.equal(new Set([...first.body.items, ...second.body.items].map((row: any) => row.id)).size, 80);
  assert.equal(first.body.items[0].sourceType, 'indexed');
});
test('saved IDs are scoped before filtering, counting and pagination', async () => {
  const page = await read('/companies/google/questions?difficulty=Easy&limit=1', {
    ids: ['preview-question-1', 'preview-question-4', 'preview-question-2', 'preview-question-100'],
  });
  assert.equal(page.body.total, 2);
  assert.equal(page.body.totalUnfiltered, 96);
  assert.equal(page.body.items.length, 1);
  const empty = await read('/companies/google/questions', { ids: [] });
  assert.equal(empty.body.total, 0);
  assert.deepEqual(empty.body.items, []);
});
test('progress includes saved questions beyond page one and excludes other companies', async () => {
  const result = await read('/companies/google/progress', {
    ids: ['preview-question-1', 'preview-question-90', 'preview-question-100', 'missing'],
  });
  assert.deepEqual(result.body.ids, ['preview-question-1', 'preview-question-90']);
});
test('invalid pagination and invalid ID payloads return 400', async () => {
  for (const query of ['limit=1.5', 'offset=Infinity', 'offset=-1']) {
    assert.equal((await read(`/companies/google/questions?${query}`)).status, 400);
  }
  assert.equal((await read('/companies/google/questions', { ids: 'all' })).status, 400);
  assert.equal((await read('/companies/google/progress', { ids: [42] })).status, 400);
});
test('community filters and empty companies retain their actual source', async () => {
  const result = await read('/companies/stripe/questions?round=Tech&role=SDE-1');
  assert.equal(result.body.total, 8);
  assert.equal(result.body.hasIndexed, false);
  assert.equal(result.body.items[0].sourceType, 'community-submitted');
  assert.equal((await read('/companies/empty/questions')).body.total, 0);
  assert.equal((await read('/companies/missing/questions')).status, 404);
});
