import test from 'node:test';
import assert from 'node:assert/strict';
import { prSummaryRows } from '../src/summary.js';

test('PR summary includes clickable link, short commit and state', () => {
  assert.deepEqual(prSummaryRows([{repo:'owner/repo',pr:12,sha:'abcdef0123456789',state:'red'}]),[
    '| [owner/repo#12](https://github.com/owner/repo/pull/12) | `abcdef0` | **RED** |'
  ]);
});
test('empty list yields no PR rows', () => assert.deepEqual(prSummaryRows([]),[]));
test('rejects invalid observations instead of rendering unsafe links', () => {
  assert.throws(()=>prSummaryRows([{repo:'x/a|bad',pr:1,sha:'abcdef0',state:'green'}]),/Invalid/);
  assert.throws(()=>prSummaryRows([{repo:'x/y',pr:1,sha:'abcdef0',state:'whatever'}]),/Invalid/);
});
