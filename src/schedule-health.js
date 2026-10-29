// Advisory only: one recent scheduled run is not proof of five-minute reliability.
export function assessScheduleHistory(data, now = Date.now(), maxAgeMinutes = 45) {
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeMinutes) || maxAgeMinutes <= 0) {
    throw new TypeError('Invalid schedule assessment inputs');
  }
  if (!data || !Number.isSafeInteger(data.total_count) || data.total_count < 0 ||
      !Array.isArray(data.workflow_runs)) {
    return { state: 'unknown', reason: 'Malformed GitHub Actions history' };
  }
  if (data.total_count === 0 && data.workflow_runs.length === 0) {
    return { state: 'never-seen', reason: 'No schedule-triggered runs returned' };
  }
  if (data.total_count === 0 || data.workflow_runs.length !== 1) {
    return { state: 'unknown', reason: 'Inconsistent scheduled-run history' };
  }
  const run = data.workflow_runs[0];
  const timestamp = Date.parse(run?.created_at);
  if (run?.event !== 'schedule' || !Number.isSafeInteger(run?.id) || run.id <= 0 ||
      !Number.isFinite(timestamp) || timestamp > now) {
    return { state: 'unknown', reason: 'Invalid scheduled-run metadata' };
  }
  const ageMinutes = Math.floor((now - timestamp) / 60000);
  const details = { lastRunAt: new Date(timestamp).toISOString(), ageMinutes, runId: run.id };
  if (ageMinutes > maxAgeMinutes) return { state: 'stale', ...details };
  // Unknown API statuses must not be mistaken for a running workflow.
  const pendingStatuses = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
  if (run.status !== 'completed' && !pendingStatuses.has(run.status)) {
    return { state: 'unknown', reason: 'Unrecognized scheduled-run status' };
  }
  if (run.status === 'completed' && run.conclusion !== 'success') {
    return { state: 'recent-not-green', ...details };
  }
  if (run.status !== 'completed') return { state: 'in-progress', ...details };
  return { state: 'observed', ...details };
}
