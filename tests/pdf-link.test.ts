import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePdfLink } from '../lib/pdf-link.ts';

test('normalizes a shared Google Drive PDF link', () => {
  const parsed = parsePdfLink(
    'https://drive.google.com/file/d/abc-123/view?usp=sharing',
  );
  assert.equal(parsed.driveId, 'abc-123');
  assert.equal(parsed.url, 'https://drive.google.com/file/d/abc-123/view');
});

test('rejects Google Drive folders', () => {
  assert.throws(
    () => parsePdfLink('https://drive.google.com/drive/folders/abc'),
    /not a PDF file link/i,
  );
});

test('allows direct HTTPS PDF endpoints', () => {
  assert.equal(
    parsePdfLink('https://example.com/book.pdf').url,
    'https://example.com/book.pdf',
  );
});
