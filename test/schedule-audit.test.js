import test from 'node:test';
import assert from 'node:assert/strict';
import { auditScheduleWindow } from '../src/schedule-audit.js';

const start = '2026-10-29T00:00:00Z';
const end = '2026-10-30T00:00:00Z';
const now = Date.parse('2026-10-30T01:00:00Z');
const run = (id, time, event = 'schedule') => ({ id, event, created_at: time });
const runs = [
  run(4, '2026-10-29T23:50:00Z'),
  run(3, '2026-10-29T23:20:00Z'),
  run(2, '2026-10-29T23:10:00Z'),
  run(1, '2026-10-29T23:00:00Z'),
  run(5, '2026-10-28T23:50:00Z')
];
const options = { start, end, now, historyComplete: true };

test('full window measures real schedule-to-schedule gaps and separate boundary silence', () => {
  const result = auditScheduleWindow(runs, options);
  assert.equal(result.state, 'gaps');
  assert.equal(result.samples, 4);
  assert.deepEqual(result.intervalsMinutes, [30, 10, 10]);
  assert.equal(result.gaps, 1);
  assert.equal(result.maxGapMinutes, 30);
  assert.deepEqual(result.largestGap, {
    older: '2026-10-29T23:20:00.000Z',
    newer: '2026-10-29T23:50:00.000Z',
    olderRunId: 3,
    newerRunId: 4
  });
  assert.equal(result.leadingSilenceMinutes, 1380);
  assert.equal(result.trailingSilenceMinutes, 10);
});

test('15 minutes is tolerated, strictly greater than 15 is a gap', () => {
  const sample = [
    run(3, '2026-10-29T12:30:01Z'),
    run(2, '2026-10-29T12:15:00Z'),
    run(1, '2026-10-29T12:00:00Z')
  ];
  assert.equal(auditScheduleWindow(sample, options).gaps, 1);
  assert.equal(auditScheduleWindow(sample.map((r, i) => i === 0 ?
    { ...r, created_at: '2026-10-29T12:30:00Z' } : r), options).gaps, 0);
});

test('an open window or incomplete pages never claim a complete audit', () => {
  assert.equal(auditScheduleWindow(runs, { ...options, now: Date.parse('2026-10-29T23:55:00Z') }).state, 'window-open');
  assert.equal(auditScheduleWindow(runs, { ...options, historyComplete: false }).state, 'incomplete-history');
  assert.equal(auditScheduleWindow([], options).state, 'insufficient-data');
  assert.equal(auditScheduleWindow([runs[0]], options).state, 'insufficient-data');
});

test('reject manual runs, duplicate IDs, malformed timestamps and unsorted pages', () => {
  const invalid = [
    [run(4, '2026-10-29T23:50:00Z', 'workflow_dispatch'), runs[1]],
    [runs[0], { ...runs[1], id: 4 }],
    [runs[0], { ...runs[1], created_at: 'invalid' }],
    [runs[1], runs[0]],
    [runs[0], run(-1, '2026-10-29T23:30:00Z')],
    [runs[0], run(99, '2026-10-31T00:00:00Z')]
  ];
  for (const sample of invalid) {
    assert.equal(auditScheduleWindow(sample, options).state, 'unknown');
  }
  assert.equal(auditScheduleWindow(null, options).state, 'unknown');
});

test('invalid audit windows and thresholds fail closed', () => {
  for (const invalid of [
    { ...options, start: 'not-a-date' },
    { ...options, end: start },
    { ...options, maxGapMinutes: 0 },
    { ...options, now: NaN }
  ]) assert.throws(() => auditScheduleWindow([], invalid), TypeError);
});
