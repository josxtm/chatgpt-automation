import test from 'node:test';
import assert from 'node:assert/strict';
import { auditScheduleWindow, auditExitCode, is24HourUtcWindow } from '../src/schedule-audit.js';

// Frozen GitHub Actions evidence for workflow 399940933, fetched 2026-10-30
// after the 24-hour window closed. Excludes recovery workflow 402150396.
const start = '2026-10-29T23:21:35Z';
const end = '2026-10-30T23:21:35Z';
const now = Date.parse('2026-10-30T23:23:00Z');
const scheduled = [
  [41125237552, '2026-10-30T20:41:55Z'],
  [41085928702, '2026-10-30T16:00:35Z'],
  [41031760853, '2026-10-30T09:12:42Z'],
  [40993752342, '2026-10-30T02:47:47Z'],
  [40899821455, '2026-10-29T15:16:08Z'],
  [40840399853, '2026-10-29T08:11:42Z'],
  [40803239959, '2026-10-29T01:54:47Z']
].map(([id, created_at]) => ({
  id, created_at, event: 'schedule', workflow_id: 399940933
}));

test('PR #17: verified 24h schedule history contains three >15-minute gaps', () => {
  assert.equal(is24HourUtcWindow(start, end), true);
  assert.ok(scheduled.every(run => run.workflow_id === 399940933));
  const audit = auditScheduleWindow(scheduled, { start, end, now, historyComplete: true });
  assert.equal(audit.state, 'gaps');
  assert.equal(audit.samples, 4);
  assert.equal(audit.gaps, 3);
  assert.deepEqual(audit.intervalsMinutes, [281.3, 407.9, 384.9]);
  assert.equal(audit.maxGapMinutes, 407.9);
  assert.deepEqual(audit.largestGap, {
    older: '2026-10-30T09:12:42.000Z',
    newer: '2026-10-30T16:00:35.000Z',
    olderRunId: 41031760853,
    newerRunId: 41085928702
  });
  assert.equal(audit.leadingSilenceMinutes, 206.2);
  assert.equal(audit.trailingSilenceMinutes, 159.7);
  assert.equal(audit.boundaryGaps, 2);
  assert.equal(auditExitCode(audit), 1, 'missing scheduled cadence must never be green');
});

test('PR #17: manual/CI runs cannot silently inflate the schedule count', () => {
  for (const event of ['workflow_dispatch', 'pull_request', 'push', 'workflow_run']) {
    const injected = [{ ...scheduled[0], id: 90000000000, event }, ...scheduled];
    assert.equal(
      auditScheduleWindow(injected, { start, end, now, historyComplete: true }).state,
      'unknown'
    );
  }
});
