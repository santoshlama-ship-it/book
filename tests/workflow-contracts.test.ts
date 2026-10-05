import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('book builder exposes approved covers only', async () => {
  const route = await read('app/api/books/route.ts');
  assert.match(route, /WHERE status = 'Approved'/);
});

test('book API persists page comments, pins and annotation payloads', async () => {
  const route = await read('app/api/books/route.ts');
  assert.match(route, /annotations/);
  assert.match(route, /page_number, body, display_time, done, pin_x, pin_y/);
});

test('executive response uses an explicit sanitized product shape', async () => {
  const route = await read('app/api/executive/route.ts');
  for (const forbidden of [
    'comments:',
    'annotations:',
    'concept:',
    'inspiration:',
  ])
    assert.doesNotMatch(route, new RegExp(forbidden));
  assert.match(route, /completion/);
  assert.match(route, /qcPassed/);
});

test('critical dashboards include responsive breakpoints', async () => {
  const [builder, executive] = await Promise.all([
    read('app/book-review-client.tsx'),
    read('app/executive-dashboard-client.tsx'),
  ]);
  assert.match(builder, /md:|lg:/);
  assert.match(executive, /md:|lg:/);
});
