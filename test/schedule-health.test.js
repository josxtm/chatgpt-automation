import test from 'node:test';
import assert from 'node:assert/strict';
import { assessScheduleHistory, assessScheduleCadence } from '../src/schedule-health.js';

const now = Date.parse('2026-10-29T00:00:00Z');
const run = { id: 42, event: 'schedule', created_at: '2026-10-28T23:55:00Z', status: 'completed', conclusion: 'success' };
const data = { total_count: 1, workflow_runs: [run] };

test('no scheduled runs must never be reported as healthy', () => {
  assert.equal(assessScheduleHistory({total_count:0,workflow_runs:[]},now).state, 'never-seen');
});
test('one recent scheduled success is observed, not a cadence guarantee', () => {
  assert.deepEqual(assessScheduleHistory(data,now), {
    state:'observed', lastRunAt:'2026-10-28T23:55:00.000Z', ageMinutes:5, runId:42
  });
});
test('old or failed scheduled runs are flagged', () => {
  assert.equal(assessScheduleHistory(data,now+46*60000).state, 'stale');
  assert.equal(assessScheduleHistory({...data,workflow_runs:[{...run,conclusion:'failure'}]},now).state,'recent-not-green');
  // An old failed run must preserve the failure signal instead of being labelled only stale.
  assert.equal(assessScheduleHistory({...data,workflow_runs:[{...run,conclusion:'failure'}]},now+46*60000).state,'stale-not-green');
  assert.equal(assessScheduleHistory({...data,workflow_runs:[{...run,conclusion:null}]},now+46*60000).state,'stale-not-green');
});
test('unknown completed-run conclusions fail closed without inventing a failure', () => {
  for (const conclusion of ['mystery', '', 123, { unexpected: true }]) {
    const response = assessScheduleHistory({...data, workflow_runs:[{...run, conclusion}]}, now);
    assert.equal(response.state, 'unknown');
    assert.match(response.reason, /conclusion/);
    assert.equal(assessScheduleHistory({...data, workflow_runs:[{...run, conclusion}]}, now+60*60000).state, 'unknown');
  }
  for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out', 'neutral', 'action_required', 'startup_failure', 'stale']) {
    assert.equal(assessScheduleHistory({...data, workflow_runs:[{...run, conclusion}]}, now).state, 'recent-not-green');
  }
  // An absent conclusion is still not evidence of success.
  assert.equal(assessScheduleHistory({...data, workflow_runs:[{...run, conclusion:null}]}, now).state, 'recent-not-green');
});

test('pending scheduled run is not green', () => {
  assert.equal(assessScheduleHistory({...data,workflow_runs:[{...run,status:'in_progress',conclusion:null}]},now).state,'in-progress');
});
test('invalid or inconsistent history fails closed', () => {
  assert.equal(assessScheduleHistory({total_count:1,workflow_runs:[]},now).state,'unknown');
  assert.equal(assessScheduleHistory({...data,workflow_runs:[{...run,event:'workflow_dispatch'}]},now).state,'unknown');
  assert.equal(assessScheduleHistory({...data,workflow_runs:[{...run,created_at:'invalid'}]},now).state,'unknown');
  assert.equal(assessScheduleHistory({...data,workflow_runs:[{...run,created_at:'2026-10-30T00:00:00Z'}]},now).state,'unknown');
});

test('unknown scheduled-run statuses fail closed instead of appearing in progress', () => {
  for (const status of [undefined, null, '', 'mystery']) {
    const response = assessScheduleHistory({...data,workflow_runs:[{...run,status}]},now);
    assert.equal(response.state, 'unknown');
  }
  for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
    assert.equal(assessScheduleHistory({...data,workflow_runs:[{...run,status,conclusion:null}]},now).state, 'in-progress');
  }
  // Age must not hide an unrecognized status: fail closed even for old runs.
  assert.equal(assessScheduleHistory({...data,workflow_runs:[{...run,status:'mystery'}]},now+60*60000).state, 'unknown');
  for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
    const oldPending = assessScheduleHistory({...data,workflow_runs:[{...run,status,conclusion:null}]},now+60*60000);
    assert.equal(oldPending.state, 'stale-in-progress');
    assert.equal(oldPending.runId, run.id);
  }
});

const cadenceRuns = [
  { id: 3, event: 'schedule', created_at: '2026-10-28T23:55:00Z' },
  { id: 2, event: 'schedule', created_at: '2026-10-28T23:50:00Z' },
  { id: 1, event: 'schedule', created_at: '2026-10-28T23:45:00Z' }
];

test('cadence reports observed intervals, never a guarantee', () => {
  assert.deepEqual(assessScheduleCadence({ total_count: 3, workflow_runs: cadenceRuns }, now), {
    state: 'no-large-gaps', samples: 3, gaps: 0, maxGapMinutes: 5,
    largestGap: { newer: '2026-10-28T23:55:00.000Z', older: '2026-10-28T23:50:00.000Z' },
    sampleWindow: { newest: '2026-10-28T23:55:00.000Z', oldest: '2026-10-28T23:45:00.000Z' }
  });
  const delayed = [cadenceRuns[0], { ...cadenceRuns[1], created_at: '2026-10-28T23:35:00Z' },
    { ...cadenceRuns[2], created_at: '2026-10-28T23:30:00Z' }];
  assert.deepEqual(assessScheduleCadence({ total_count: 3, workflow_runs: delayed }, now), {
    state: 'gaps', samples: 3, gaps: 1, maxGapMinutes: 20,
    largestGap: { newer: '2026-10-28T23:55:00.000Z', older: '2026-10-28T23:35:00.000Z' },
    sampleWindow: { newest: '2026-10-28T23:55:00.000Z', oldest: '2026-10-28T23:30:00.000Z' }
  });
});

test('cadence requires enough scheduled runs and rejects malformed samples', () => {
  assert.equal(assessScheduleCadence({ total_count: 0, workflow_runs: [] }, now).state, 'never-seen');
  assert.equal(assessScheduleCadence({ total_count: 1, workflow_runs: cadenceRuns.slice(0, 1) }, now).state, 'insufficient-data');
  for (const runs of [
    [cadenceRuns[0], cadenceRuns[0], cadenceRuns[2]],
    [cadenceRuns[1], cadenceRuns[0], cadenceRuns[2]],
    [{ ...cadenceRuns[0], event: 'workflow_dispatch' }, ...cadenceRuns.slice(1)],
    [{ ...cadenceRuns[0], created_at: '2026-10-30T00:00:00Z' }, ...cadenceRuns.slice(1)]
  ]) {
    assert.equal(assessScheduleCadence({ total_count: 3, workflow_runs: runs }, now).state, 'unknown');
  }
  assert.equal(assessScheduleCadence({ total_count: 2, workflow_runs: cadenceRuns }, now).state, 'unknown');
  assert.equal(assessScheduleCadence({ total_count: 3, workflow_runs: null }, now).state, 'unknown');
});

test('two scheduled starts expose a real gap without claiming reliable cadence', () => {
  const sparse = [
    cadenceRuns[0],
    { ...cadenceRuns[1], created_at: '2026-10-28T17:35:00Z' }
  ];
  assert.deepEqual(assessScheduleCadence({ total_count: 2, workflow_runs: sparse }, now), {
    state: 'insufficient-data',
    samples: 2,
    gaps: 1,
    maxGapMinutes: 380,
    largestGap: { newer: '2026-10-28T23:55:00.000Z', older: '2026-10-28T17:35:00.000Z' },
    sampleWindow: { newest: '2026-10-28T23:55:00.000Z', oldest: '2026-10-28T17:35:00.000Z' }
  });
  assert.deepEqual(assessScheduleCadence({ total_count: 1, workflow_runs: [cadenceRuns[0]] }, now), {
    state: 'insufficient-data', samples: 1, gaps: 0, maxGapMinutes: 0, largestGap: null,
    sampleWindow: { newest: '2026-10-28T23:55:00.000Z', oldest: '2026-10-28T23:55:00.000Z' }
  });
});
