import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldInspect, inspectionStep } from '../src/recovery.js';

const now = Date.parse('2026-10-30T18:00:00Z');
const context = { repo: 'josxtm/chatgpt-automation', runId: 99, now };
const baseRun = {
  id: 1, head_branch: 'main', status: 'completed',
  created_at: '2026-10-30T17:55:00Z'
};
const baseStep = {
  name: inspectionStep, conclusion: 'success',
  completed_at: '2026-10-30T17:56:00Z'
};

function getHistory({ runTimestamp = baseRun.created_at, receiptTimestamp = baseStep.completed_at } = {}) {
  return async path => {
    if (path.includes('/jobs?')) {
      return { total_count: 1, jobs: [{ steps: [{ ...baseStep, completed_at: receiptTimestamp }] }] };
    }
    if (path.includes('/supervisor.yml/')) {
      return { total_count: 1, workflow_runs: [{ ...baseRun, created_at: runTimestamp }] };
    }
    return { total_count: 0, workflow_runs: [] };
  };
}

test('canonical UTC recovery timestamps retain valid idempotent receipts', async () => {
  assert.equal(await shouldInspect(getHistory(), context), false);
  assert.equal(await shouldInspect(getHistory({
    runTimestamp: '2026-10-30T17:55:00.123Z',
    receiptTimestamp: '2026-10-30T17:56:00.12Z'
  }), context), false);
});

test('ambiguous or impossible run timestamps cannot authorize a recovery decision', async () => {
  for (const runTimestamp of [
    '2026-10-30T17:55:00+00:00',
    '2026-10-30T17:55:00',
    '2026-10-30 17:55:00',
    '2026-02-30T17:55:00Z',
    '2026-13-30T17:55:00Z',
    '2026-10-30T17:55:00.1234Z',
    1793382900000,
    null
  ]) {
    await assert.rejects(shouldInspect(getHistory({ runTimestamp }), context),
      /Invalid recovery history/, String(runTimestamp));
  }
});

test('ambiguous or impossible inspection completion timestamps never become receipts', async () => {
  for (const receiptTimestamp of [
    '2026-10-30T17:56:00+00:00',
    '2026-10-30T17:56:00',
    '2026-10-30 17:56:00',
    '2026-02-30T17:56:00Z',
    '2026-10-30T17:56:00.1234Z',
    1793382960000,
    null
  ]) {
    await assert.rejects(shouldInspect(getHistory({ receiptTimestamp }), context),
      /Invalid inspection receipt/, String(receiptTimestamp));
  }
});
