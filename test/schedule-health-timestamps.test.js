import test from 'node:test';
import assert from 'node:assert/strict';
import { assessScheduleHistory, assessScheduleCadence, assessScheduleRevision } from '../src/schedule-health.js';

const now = Date.parse('2026-10-29T00:00:00Z');
const sha = 'a'.repeat(40);
const run = {
  id: 3,
  event: 'schedule',
  created_at: '2026-10-28T23:55:00Z',
  status: 'completed',
  conclusion: 'success',
  head_sha: sha
};
const page = (runs) => ({ total_count: runs.length, workflow_runs: runs });

test('impossible or ambiguous GitHub timestamps never prove a healthy schedule', () => {
  const malformed = [
    '2026-02-30T23:55:00Z',
    '2026-13-01T23:55:00Z',
    '2026-10-28 23:55:00',
    '2026-10-28T23:55:00+00:00',
    '2026-10-28T23:55:00',
    '2026-10-28T23:55:00.1234Z',
    1793231700000,
    null
  ];
  for (const created_at of malformed) {
    const candidate = { ...run, created_at };
    assert.equal(assessScheduleHistory(page([candidate]), now).state, 'unknown', String(created_at));
    assert.equal(assessScheduleCadence(page([
      candidate,
      { ...run, id: 2, created_at: '2026-10-28T23:45:00Z' },
      { ...run, id: 1, created_at: '2026-10-28T23:35:00Z' }
    ]), now).state, 'unknown', String(created_at));
    assert.equal(assessScheduleRevision(page([candidate]), sha, now).state, 'unknown', String(created_at));
  }
});

test('canonical UTC seconds and millisecond precision remain supported', () => {
  const fractional = [
    { ...run, created_at: '2026-10-28T23:55:00.123Z' },
    { ...run, id: 2, created_at: '2026-10-28T23:45:00.12Z' },
    { ...run, id: 1, created_at: '2026-10-28T23:35:00.1Z' }
  ];
  assert.equal(assessScheduleHistory(page([fractional[0]]), now).state, 'observed');
  assert.equal(assessScheduleCadence(page(fractional), now).state, 'no-large-gaps');
  assert.equal(assessScheduleRevision(page([fractional[0]]), sha, now).state, 'current-revision');
});

test('revision check rejects future schedule starts and invalid clock', () => {
  assert.equal(assessScheduleRevision(page([{ ...run, created_at: '2026-10-30T00:00:00Z' }]), sha, now).state, 'unknown');
  assert.equal(assessScheduleRevision(page([run]), sha, NaN).state, 'unknown');
});
