import { validateScheduleHistoryPage } from './schedule-audit.js';

export const inspectionStep = 'Inspect configured repositories (read-only)';

// Reject ambiguous or impossible dates before they can authorize duplicate suppression.
// GitHub Actions run/step timestamps are UTC ISO 8601 instants.
function parseUtcTimestamp(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19) ? parsed : NaN;
}


// Called only inside the shared Actions concurrency group. Completed inspection
// steps are receipts; skipped gates, failed runs and CI never refresh the receipt.
export async function shouldInspect(get, { repo, runId, now = Date.now(), intervalMs = 600000 }) {
  if (!/^[\w-]+\/[\w.-]+$/.test(repo || '') || repo.split('/').includes('..') ||
      !Number.isSafeInteger(runId) || runId <= 0 || !Number.isFinite(now) ||
      !Number.isSafeInteger(intervalMs) || intervalMs <= 0) throw new Error('Invalid recovery context');
  const cutoff = now - intervalMs;
  for (const workflow of ['supervisor.yml', 'supervisor-recovery.yml']) {
    let seen = 0;
    let total = null;
    let covered = false;
    const ids = new Set();
    let previous = Infinity;
    for (let page = 1; page <= 10; page++) {
      const data = await get(`/repos/${repo}/actions/workflows/${workflow}/runs?branch=main&per_page=100&page=${page}`);
      const state = validateScheduleHistoryPage(data, seen, total);
      total = state.totalCount;
      seen += data.workflow_runs.length;
      for (const run of data.workflow_runs) {
        const timestamp = parseUtcTimestamp(run?.created_at);
        if (!Number.isSafeInteger(run?.id) || run.id <= 0 || ids.has(run.id) || !Number.isFinite(timestamp) || timestamp > now || timestamp > previous || run.head_branch !== 'main') throw new Error('Invalid recovery history');
        ids.add(run.id);
        previous = timestamp;
        // The inspect job has a four-minute timeout; include older starts whose
        // successful inspection could still fall inside the receipt interval.
        if (timestamp < cutoff - 300000) { covered = true; continue; }
        if (run.id === runId || run.status !== 'completed') continue;
        const jobs = await get(`/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`);
        if (!Array.isArray(jobs?.jobs) || jobs.total_count !== jobs.jobs.length) throw new Error('Incomplete recovery jobs');
        for (const job of jobs.jobs) {
          if (!Array.isArray(job.steps)) throw new Error('Missing recovery steps');
          for (const step of job.steps) {
            if (step.name !== inspectionStep || step.conclusion !== 'success') continue;
            const finished = parseUtcTimestamp(step.completed_at);
            if (!Number.isFinite(finished) || finished > now) throw new Error('Invalid inspection receipt');
            if (finished > cutoff) return false;
          }
        }
      }
      if (state.complete || covered) { covered = true; break; }
    }
    if (!covered) throw new Error('Recovery pagination limit: history unknown');
  }
  return true;
}
