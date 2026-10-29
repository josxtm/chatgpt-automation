// Advisory only: one recent scheduled run is not proof of ten-minute reliability.
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
  // Validate status before age: an unknown status must never be labelled stale
  // (or otherwise treated as a recognized scheduled-run state).
  const pendingStatuses = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
  if (run.status !== 'completed' && !pendingStatuses.has(run.status)) {
    return { state: 'unknown', reason: 'Unrecognized scheduled-run status' };
  }
  // A queued/running execution cannot already have a final conclusion.
  // Inconsistent API metadata must not be presented as a normal pending run.
  if (run.status !== 'completed' && run.conclusion != null) {
    return { state: 'unknown', reason: 'Inconsistent pending-run conclusion' };
  }
  // Unknown conclusions are not valid evidence of a known failure mode.
  // Keep them unknown rather than presenting malformed API data as a failed run.
  const knownConclusions = new Set([
    'success', 'failure', 'cancelled', 'skipped', 'timed_out',
    'neutral', 'action_required', 'startup_failure', 'stale'
  ]);
  if (run.status === 'completed' && run.conclusion != null && !knownConclusions.has(run.conclusion)) {
    return { state: 'unknown', reason: 'Unrecognized scheduled-run conclusion' };
  }
  // Preserve both facts when the latest completed run is old AND not green.
  // A stale failure must not be described merely as a scheduling delay.
  if (run.status === 'completed' && run.conclusion !== 'success') {
    return { state: ageMinutes > maxAgeMinutes ? 'stale-not-green' : 'recent-not-green', ...details };
  }
  // An old queued/running job has two problems: it is overdue and still unfinished.
  // Preserve both signals instead of hiding the pending state under 'stale'.
  if (ageMinutes > maxAgeMinutes && run.status !== 'completed') return { state: 'stale-in-progress', ...details };
  if (ageMinutes > maxAgeMinutes) return { state: 'stale', ...details };
  if (run.status !== 'completed') return { state: 'in-progress', ...details };
  return { state: 'observed', ...details };
}

/**
 * Advisory sample of the most recent scheduled starts. A short sample without
 * large gaps does not guarantee future ten-minute delivery.
 */
export function assessScheduleCadence(data, now = Date.now(), maxGapMinutes = 15) {
  if (!Number.isFinite(now) || !Number.isFinite(maxGapMinutes) || maxGapMinutes <= 0) {
    throw new TypeError('Invalid cadence assessment inputs');
  }
  if (!data || !Number.isSafeInteger(data.total_count) || data.total_count < 0 ||
      !Array.isArray(data.workflow_runs)) {
    return { state: 'unknown', reason: 'Malformed scheduled-run history' };
  }
  const runs = data.workflow_runs;
  if (data.total_count === 0 && runs.length === 0) return { state: 'never-seen', samples: 0 };
  // The API request uses per_page=12. A short or truncated page must not
  // be mistaken for a complete, regular sample with no missing triggers.
  const expectedSamples = Math.min(data.total_count, 12);
  if (runs.length !== expectedSamples) {
    return { state: 'unknown', reason: 'Incomplete or inconsistent cadence sample' };
  }
  const ids = new Set();
  let previous = null;
  let previousRunId = null;
  let gaps = 0;
  let maxGap = 0;
  let largestGap = null;
  for (const run of runs) {
    const timestamp = Date.parse(run?.created_at);
    if (run?.event !== 'schedule' || !Number.isSafeInteger(run?.id) || run.id <= 0 ||
        ids.has(run.id) || !Number.isFinite(timestamp) || timestamp > now ||
        (previous !== null && timestamp >= previous)) {
      return { state: 'unknown', reason: 'Invalid or unordered scheduled-run metadata' };
    }
    ids.add(run.id);
    if (previous !== null) {
      const gapMinutes = (previous - timestamp) / 60000;
      if (gapMinutes > maxGap) {
        maxGap = gapMinutes;
        largestGap = {
          newer: new Date(previous).toISOString(),
          older: new Date(timestamp).toISOString(),
          newerRunId: previousRunId,
          olderRunId: run.id
        };
      }
      if (gapMinutes > maxGapMinutes) gaps++;
    }
    previous = timestamp;
    previousRunId = run.id;
  }
  const sampleWindow = {
    newest: new Date(Date.parse(runs[0].created_at)).toISOString(),
    oldest: new Date(previous).toISOString()
  };
  // Even two real starts can expose a large gap. Keep the sample insufficient
  // for a cadence verdict, but never discard the observed interval evidence.
  if (runs.length < 3) return {
    state: 'insufficient-data',
    samples: runs.length,
    gaps,
    maxGapMinutes: Math.round(maxGap * 10) / 10,
    largestGap,
    sampleWindow
  };
  return {
    state: gaps ? 'gaps' : 'no-large-gaps',
    samples: runs.length,
    gaps,
    maxGapMinutes: Math.round(maxGap * 10) / 10,
    largestGap,
    sampleWindow,
    // A full first page may still omit older scheduled starts.
    ...(data.total_count > runs.length ? { limited: true, totalRuns: data.total_count } : {})
  };
}

/**
 * Compare the latest scheduled run with the revision being inspected.
 * A different SHA is evidence of an older revision, NOT proof that the
 * current cron is disabled or broken (a new commit may have just landed).
 */
export function assessScheduleRevision(data, currentSha) {
  const validSha = sha => typeof sha === 'string' && /^[a-f0-9]{40}$/i.test(sha);
  if (!validSha(currentSha)) return { state: 'unknown', reason: 'Current commit SHA unavailable' };
  if (!data || !Number.isSafeInteger(data.total_count) || data.total_count < 0 ||
      !Array.isArray(data.workflow_runs)) {
    return { state: 'unknown', reason: 'Malformed scheduled-run history' };
  }
  if (data.total_count === 0 && data.workflow_runs.length === 0) return { state: 'never-seen' };
  if (data.total_count === 0 || data.workflow_runs.length < 1) {
    return { state: 'unknown', reason: 'Inconsistent scheduled-run history' };
  }
  const latest = data.workflow_runs[0];
  if (latest?.event !== 'schedule' || !Number.isSafeInteger(latest.id) || latest.id <= 0 ||
      !validSha(latest.head_sha)) {
    return { state: 'unknown', reason: 'Invalid scheduled-run revision metadata' };
  }
  return {
    state: latest.head_sha.toLowerCase() === currentSha.toLowerCase() ? 'current-revision' : 'older-revision',
    runSha: latest.head_sha.toLowerCase(),
    currentSha: currentSha.toLowerCase()
  };
}
