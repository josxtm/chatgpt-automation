import test from 'node:test';
import assert from 'node:assert/strict';
import { auditScheduleWindow } from '../src/schedule-audit.js';

const start = '2026-10-29T00:00:00Z';
const end = '2026-10-30T00:00:00Z';
const options = { start, end, now: Date.parse('2026-10-30T01:00:00Z'), historyComplete: true };
const run = (id, created_at) => ({ id, created_at, event: 'schedule' });

test('audit preserves every >15-minute interval with both run IDs and timestamps', () => {
  const result = auditScheduleWindow([
    run(4, '2026-10-29T23:55:00Z'),
    run(3, '2026-10-29T23:30:00Z'),
    run(2, '2026-10-29T23:15:00Z'),
    run(1, '2026-10-29T22:50:00Z')
  ], options);
  assert.equal(result.gaps, 2);
  assert.deepEqual(result.gapDetails, [
    { older: '2026-10-29T23:30:00.000Z', newer: '2026-10-29T23:55:00.000Z', olderRunId: 3, newerRunId: 4, minutes: 25 },
    { older: '2026-10-29T22:50:00.000Z', newer: '2026-10-29T23:15:00.000Z', olderRunId: 1, newerRunId: 2, minutes: 25 }
  ]);
  assert.equal(result.largestGap.olderRunId, 3);
  assert.equal(result.largestGap.newerRunId, 4);
});

test('exactly 15 minutes is not reported as a gap', () => {
  const result = auditScheduleWindow([
    run(2, '2026-10-29T23:30:00Z'),
    run(1, '2026-10-29T23:15:00Z')
  ], options);
  assert.equal(result.gaps, 0);
  assert.deepEqual(result.gapDetails, []);
});


test('audit exposes real first and last run links without inventing schedule events', () => {
  const result = auditScheduleWindow([
    run(4, '2026-10-29T23:55:00Z'),
    run(3, '2026-10-29T23:30:00Z'),
    run(2, '2026-10-29T23:15:00Z'),
    run(1, '2026-10-28T23:50:00Z')
  ], options);
  assert.deepEqual(result.firstRun, { id: 2, createdAt: '2026-10-29T23:15:00.000Z' });
  assert.deepEqual(result.lastRun, { id: 4, createdAt: '2026-10-29T23:55:00.000Z' });
  const empty = auditScheduleWindow([], options);
  assert.equal(empty.firstRun, null);
  assert.equal(empty.lastRun, null);
  assert.equal(empty.state, 'insufficient-data');
});
