// Usage: GH_TOKEN=... node scripts/audit-schedule.mjs START_UTC END_UTC
// A read-only report; this script does not dispatch workflows or modify PRs.
import { appendFileSync } from 'node:fs';
import { auditScheduleWindow, auditExitCode, validateScheduleHistoryPage, is24HourUtcWindow } from '../src/schedule-audit.js';

const [start, end] = process.argv.slice(2);
const repo = process.env.GITHUB_REPOSITORY || 'josxtm/chatgpt-automation';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!is24HourUtcWindow(start, end) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || !token) {
  console.error('Usage: GH_TOKEN=... node scripts/audit-schedule.mjs START_UTC END_UTC (exactly 24h, YYYY-MM-DDTHH:mm:ssZ)');
  process.exit(2);
}

async function loadScheduleHistory() {
  const runs = [];
  let reportedTotal = null;
  const from = Date.parse(start);
  if (!Number.isFinite(from)) throw new Error('Invalid start timestamp');
  for (let page = 1; page <= 20; page++) {
    const path = '/repos/' + repo + '/actions/workflows/supervisor.yml/runs?event=schedule&per_page=100&page=' + page;
    const response = await fetch('https://api.github.com' + path, {
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'chatgpt-automation-audit'
      }
    });
    if (!response.ok) throw new Error('GitHub Actions API HTTP ' + response.status + ' on page ' + page);
    const data = await response.json();
    const pageState = validateScheduleHistoryPage(data, runs.length, reportedTotal);
    reportedTotal = pageState.totalCount;
    runs.push(...data.workflow_runs);
    const oldest = data.workflow_runs.at(-1);
    // Fetch enough pages to cover the beginning of the requested window.
    // A short final page, or all reported rows, also proves pagination ended.
    if (!oldest || Date.parse(oldest.created_at) < from ||
        pageState.complete) {
      return { runs, historyComplete: true };
    }
  }
  // A cap must never be interpreted as complete history.
  return { runs, historyComplete: false };
}

try {
  const { runs, historyComplete } = await loadScheduleHistory();
  const audit = auditScheduleWindow(runs, { start, end, historyComplete });
  console.log(JSON.stringify(audit, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = [
      '## Auditoría de disparos schedule (solo lectura)',
      '',
      '- Ventana UTC: ' + audit.start + ' → ' + audit.end,
      '- Estado: **' + audit.state + '**',
      '- Disparos automáticos: ' + audit.samples,
      '- Intervalos >15 minutos: ' + audit.gaps,
      '- Máximo intervalo observado: ' + (audit.maxGapMinutes ?? 'sin datos') + ' minutos',
      '- Historial completo: ' + audit.historyComplete,
      '- Silencios de borde >15 minutos: ' + audit.boundaryGaps,
      '- Silencio inicial/final (min): ' + (audit.leadingSilenceMinutes ?? 'sin datos') +
        ' / ' + (audit.trailingSilenceMinutes ?? 'sin datos'),
      ''
    ];
    if (audit.largestGap) {
      rows.push('- Mayor hueco: ' + audit.largestGap.older + ' → ' + audit.largestGap.newer);
      rows.push('- Ejecuciones: https://github.com/' + repo + '/actions/runs/' +
        audit.largestGap.olderRunId + ' y https://github.com/' + repo + '/actions/runs/' +
        audit.largestGap.newerRunId);
    }
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, rows.join('\n') + '\n');
  }
  // Nonzero for unfinished, inconclusive or unhealthy cadence: never imply success.
  process.exitCode = auditExitCode(audit);
} catch (error) {
  console.error('Audit unavailable (no healthy-cadence claim): ' + String(error));
  process.exitCode = 1;
}
