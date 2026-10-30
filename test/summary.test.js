import test from 'node:test';
import assert from 'node:assert/strict';
import { prSummaryRows } from '../src/summary.js';

const valid = {repo:'owner/repo',pr:12,sha:'abcdef0123456789abcdef0123456789abcdef01',state:'red'};
test('PR summary includes clickable link, short commit and state', () => {
  assert.deepEqual(prSummaryRows([valid]),[
    '| [owner/repo#12](https://github.com/owner/repo/pull/12) | `abcdef0` | **RED** |'
  ]);
});
test('empty list yields no PR rows', () => assert.deepEqual(prSummaryRows([]),[]));
test('rejects invalid observations instead of rendering unsafe links', () => {
  for (const repo of ['x/a|bad','./repo','owner/..','../repo']) {
    assert.throws(()=>prSummaryRows([{...valid,repo}]),/Invalid/);
  }
  for (const pr of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>prSummaryRows([{...valid,pr}]),/Invalid/);
  }
  for (const sha of ['abcdef0','abcdef0123456789','g'.repeat(40),'a'.repeat(39),'a'.repeat(41)]) {
    assert.throws(()=>prSummaryRows([{...valid,sha}]),/Invalid/);
  }
  assert.throws(()=>prSummaryRows([{...valid,state:'whatever'}]),/Invalid/);
  assert.throws(()=>prSummaryRows([null]),/Invalid/);
});
