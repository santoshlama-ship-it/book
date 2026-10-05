import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyQc, reviewQc, validQc } from '../lib/book-qc.ts';

test('QC levels must be completed in order', () => {
  assert.throws(
    () => reviewQc(emptyQc(), 1, true, 'Reviewer', ''),
    /earlier QC levels/i,
  );
});

test('approved QC chain is valid and preserves reviewer evidence', () => {
  let qc = reviewQc(emptyQc(), 0, true, 'Content lead', '');
  qc = reviewQc(qc, 1, true, 'Design lead', '');
  qc = reviewQc(qc, 2, true, 'Production lead', '');
  assert.equal(validQc(qc), true);
  assert.deepEqual(
    qc.map((item) => item.reviewer),
    ['Content lead', 'Design lead', 'Production lead'],
  );
});

test('changes-needed requires a note', () => {
  assert.throws(
    () => reviewQc(emptyQc(), 0, false, 'Reviewer', ''),
    /Describe the changes/i,
  );
});
