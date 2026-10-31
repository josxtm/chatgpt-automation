import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldInspect, inspectionStep } from '../src/recovery.js';

const now = Date.parse('2026-10-31T06:30:00Z');
const context = { repo: 'josxtm/chatgpt-automation', runId: 999, now };

function history({ started = '2026-10-31T06:25:00Z', finished = '2026-10-31T06:26:00Z' } = {}) {
  return async path => {
    if (path.includes('/jobs?')) {
      return {
        total_count: 1,
        jobs: [{ steps: [{ name: inspectionStep, conclusion: 'success', completed_at: finished }] }]
      };
    }
    if (path.includes('/supervisor.yml/')) {
      return {
        total_count: 1,
        workflow_runs: [{
          id: 123,
          head_branch: 'main',
          status: 'completed',
          created_at: started
        }]
      };
    }
    return { total_count: 0, workflow_runs: [] };
  };
}

test('a successful receipt cannot predate the workflow run that claims it', async () => {
  await assert.rejects(
    shouldInspect(history({ finished: '2026-10-31T06:24:59Z' }), context),
    /Invalid inspection receipt/
  );
});

test('a valid receipt at or after run creation still suppresses duplicate work', async () => {
  assert.equal(await shouldInspect(history({ finished: '2026-10-31T06:25:00Z' }), context), false);
  assert.equal(await shouldInspect(history(), context), false);
});

test('a receipt from a run that starts after its recorded completion fails closed', async () => {
  await assert.rejects(
    shouldInspect(history({
      started: '2026-10-31T06:29:00Z',
      finished: '2026-10-31T06:28:59Z'
    }), context),
    /Invalid inspection receipt/
  );
});
