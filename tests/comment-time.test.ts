import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCommentTime } from '../lib/comment-time.ts';

test('comment timestamps display their actual date and time', () => {
  const formatted = formatCommentTime('2026-10-08T10:15:00.000Z');
  assert.match(formatted, /2026/);
  assert.doesNotMatch(formatted, /Just now/i);
});

test('legacy labels remain readable when no timestamp exists', () => {
  assert.equal(formatCommentTime('From Google Sheets'), 'From Google Sheets');
});
