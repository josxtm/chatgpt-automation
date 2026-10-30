import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldInspect, inspectionStep } from '../src/recovery.js';
const now = Date.parse('2026-10-30T18:00:00Z');
const context = { repo: 'josxtm/chatgpt-automation', runId: 99, now };
const run = { id: 1, head_branch: 'main', created_at: '2026-10-30T17:55:00Z', status: 'completed' };
function api({ runs = [run], steps = [], error = false, truncated = false } = {}) {
  return async path => {
    if (error) throw new Error('GitHub API 403');
    if (path.includes('/jobs?')) return { total_count: 1, jobs: [{ steps }] };
    return { total_count: runs.length + Number(truncated), workflow_runs: runs };
  };
}
const receipt = { name: inspectionStep, conclusion: 'success', completed_at: '2026-10-30T17:56:00Z' };
test('successful inspection suppresses repeated triggers and reruns', async () => {
  const get = api({ steps: [receipt] });
  assert.equal(await shouldInspect(get, context), false);
  assert.equal(await shouldInspect(get, context), false);
});
test('interrupted, failed, skipped or CI steps never become receipts', async () => {
  for (const steps of [[], [{ ...receipt, conclusion: 'failure' }], [{ ...receipt, conclusion: 'skipped' }], [{ ...receipt, name: 'Run tests' }]]) {
    assert.equal(await shouldInspect(api({ steps }), context), true);
  }
  assert.equal(await shouldInspect(api({ runs: [{ ...run, status: 'in_progress' }], steps: [receipt] }), context), true);
});
test('expired receipt and exact ten-minute boundary allow a fresh inspection', async () => {
  assert.equal(await shouldInspect(api({ steps: [{ ...receipt, completed_at: '2026-10-30T17:50:00Z' }] }), context), true);
});
test('receipts from the fallback workflow also prevent duplicate native work', async () => {
  const get = async path => path.includes('/supervisor.yml/') ?
    { total_count: 0, workflow_runs: [] } : api({ steps: [receipt] })(path);
  assert.equal(await shouldInspect(get, context), false);
});
test('API errors, partial pages and malformed receipts fail closed', async () => {
  for (const get of [api({ error: true }), api({ truncated: true }), api({ steps: [{ ...receipt, completed_at: 'bad' }] }), async path => path.includes('/jobs?') ? { total_count: 2, jobs: [] } : api()(path)]) {
    await assert.rejects(shouldInspect(get, context));
  }
});
test('current run cannot suppress itself after interruption', async () => {
  assert.equal(await shouldInspect(api({ runs: [{ ...run, id: 99 }], steps: [receipt] }), context), true);
});
test('shared reusable workflow serializes native and recovery work with read-only permissions', () => {
  const native = readFileSync(new URL('../.github/workflows/supervisor.yml', import.meta.url), 'utf8');
  const fallback = readFileSync(new URL('../.github/workflows/supervisor-recovery.yml', import.meta.url), 'utf8');
  assert.match(native, /workflow_call:/);
  assert.match(native, /group: multiproject-supervisor\n  cancel-in-progress: false/);
  assert.match(native, /timeout-minutes: 4/);
  assert.match(native, /if: steps.gate.outputs.inspect == 'true'/);
  assert.match(fallback, /uses: .\/.github\/workflows\/supervisor.yml/);
  assert.match(fallback, /head_repository.full_name == github.repository/);
  assert.match(fallback, /workflow_run.event != 'pull_request'/);
  assert.doesNotMatch(fallback, /secrets: inherit|write|checkout@|download-artifact|repository_dispatch|pull_request_target/);
  assert.doesNotMatch(native + fallback, /actions: write|contents: write/);
});

test('unordered, duplicate and future run history cannot authorize work', async () => {
  for (const runs of [[run, run], [{ ...run, created_at: '2026-10-31T00:00:00Z' }], [run, { ...run, id: 2, created_at: '2026-10-30T17:59:00Z' }]]) {
    await assert.rejects(shouldInspect(api({ runs }), context));
  }
});
test('history page cap cannot authorize work with an incomplete window', async () => {
  const get = async path => {
    if (path.includes('/jobs?')) return { total_count: 0, jobs: [] };
    const page = Number(new URL('https://api.github.com' + path).searchParams.get('page'));
    return { total_count: 1100, workflow_runs: Array.from({ length: 100 }, (_, i) => ({ ...run, id: page * 1000 + i })) };
  };
  await assert.rejects(shouldInspect(get, context), /pagination limit/);
});
