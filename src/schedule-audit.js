// The command-line audit must not silently inspect a shorter or shifted window.
// Accept only canonical UTC seconds and exactly 24 elapsed hours.
export function is24HourUtcWindow(start, end) {
  const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  if (typeof start !== 'string' || typeof end !== 'string' ||
      !utc.test(start) || !utc.test(end)) return false;
  const from = Date.parse(start);
  const to = Date.parse(end);
  return Number.isFinite(from) && Number.isFinite(to) &&
    new Date(from).toISOString() === start.replace('Z', '.000Z') &&
    new Date(to).toISOString() === end.replace('Z', '.000Z') &&
    to - from === 24 * 60 * 60 * 1000;
}

// Read-only, bounded 24-hour audit of actual GitHub schedule starts.
// No manual dispatches, CI runs, or inferred cron ticks count as evidence.
export function auditScheduleWindow(runs, options = {}) {
  const { start, end, now = Date.now(), historyComplete = false, maxGapMinutes = 15 } = options;
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from ||
      !Number.isFinite(now) || !Number.isFinite(maxGapMinutes) || maxGapMinutes <= 0) {
    throw new TypeError('Invalid audit window or threshold');
  }
  if (!Array.isArray(runs)) return { state: 'unknown', reason: 'Missing schedule history' };

  const seen = new Set();
  const selected = [];
  let previous = Infinity;
  for (const run of runs) {
    const timestamp = Date.parse(run?.created_at);
    if (run?.event !== 'schedule' || !Number.isSafeInteger(run?.id) || run.id <= 0 ||
        seen.has(run.id) || !Number.isFinite(timestamp) || timestamp > now ||
        timestamp > previous) {
      return { state: 'unknown', reason: 'Invalid, duplicate or unordered schedule history' };
    }
    seen.add(run.id);
    previous = timestamp;
    if (timestamp >= from && timestamp < to) selected.push({ id: run.id, timestamp });
  }

  let gaps = 0;
  let maxGap = null;
  let largestGap = null;
  const intervalsMinutes = [];
  for (let i = 1; i < selected.length; i++) {
    const newer = selected[i - 1];
    const older = selected[i];
    const minutes = (newer.timestamp - older.timestamp) / 60000;
    intervalsMinutes.push(Math.round(minutes * 10) / 10);
    if (minutes > maxGapMinutes) gaps++;
    if (maxGap === null || minutes > maxGap) {
      maxGap = minutes;
      largestGap = {
        older: new Date(older.timestamp).toISOString(),
        newer: new Date(newer.timestamp).toISOString(),
        olderRunId: older.id,
        newerRunId: newer.id
      };
    }
  }

  // A closed window can hide hours without a single start at its edges.
  // Keep edge silences separate from intervals between actual runs, but never
  // report "no-large-gaps" when either edge exceeds the same threshold.
  const leadingSilence = selected.length ? (selected.at(-1).timestamp - from) / 60000 : null;
  const trailingSilence = selected.length ? (Math.min(to, now) - selected[0].timestamp) / 60000 : null;
  const boundaryGaps = [leadingSilence, trailingSilence]
    .filter(minutes => minutes !== null && minutes > maxGapMinutes).length;
  const windowClosed = now >= to;
  // Only an explicit boolean true proves the loader finished its pagination.
  // Truthy strings or numbers must not allow a healthy-cadence verdict.
  const complete = historyComplete === true;
  const state = !windowClosed ? 'window-open' :
    !complete ? 'incomplete-history' :
    selected.length < 2 ? 'insufficient-data' :
    gaps ? 'gaps' : boundaryGaps ? 'boundary-gaps' : 'no-large-gaps';
  const round = value => Math.round(value * 10) / 10;
  return {
    state,
    start: new Date(from).toISOString(),
    end: new Date(to).toISOString(),
    historyComplete: complete,
    samples: selected.length,
    intervalsMinutes,
    gaps,
    maxGapMinutes: maxGap === null ? null : round(maxGap),
    largestGap,
    // Boundary silences are not counted as inter-run gaps.
    boundaryGaps,
    leadingSilenceMinutes: leadingSilence === null ? null : round(leadingSilence),
    trailingSilenceMinutes: trailingSilence === null ? null : round(trailingSilence)
  };
}

// Only a completed, fully evidenced and gap-free window is a successful audit.
// A diagnostic state (including an unfinished window) must never exit green.
export function auditExitCode(audit) {
  return audit?.state === 'no-large-gaps' &&
    audit.historyComplete === true &&
    Number.isSafeInteger(audit.samples) && audit.samples >= 2 &&
    audit.gaps === 0 && audit.boundaryGaps === 0 ? 0 : 1;
}

// A short GitHub Actions page is complete only when its reported total agrees.
// Fail closed on truncated pages or totals changing during pagination.
export function validateScheduleHistoryPage(data, seenCount, previousTotal = null, pageSize = 100) {
  if (!data || !Number.isSafeInteger(data.total_count) || data.total_count < 0 ||
      !Array.isArray(data.workflow_runs) || !Number.isSafeInteger(seenCount) || seenCount < 0 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 ||
      (previousTotal !== null && data.total_count !== previousTotal)) {
    throw new Error('Malformed or inconsistent GitHub Actions history page');
  }
  const count = data.workflow_runs.length;
  const nextCount = seenCount + count;
  if (count > pageSize || nextCount > data.total_count ||
      (count < pageSize && nextCount !== data.total_count)) {
    throw new Error('Truncated or inconsistent GitHub Actions history page');
  }
  return { totalCount: data.total_count, complete: nextCount === data.total_count };
}
