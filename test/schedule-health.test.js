import test from 'node:test';
import assert from 'node:assert/strict';
import { assessScheduleHistory } from '../src/schedule-health.js';

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
});
