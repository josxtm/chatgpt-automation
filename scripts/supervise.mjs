import { readFileSync, appendFileSync } from 'node:fs';

const started = new Date().toISOString();
const summary = ['# Multiproject Supervisor', '', '- Inicio (UTC): ' + started, '- Disparador: ' + (process.env.GITHUB_EVENT_NAME || 'local'), '- Rama: ' + (process.env.GITHUB_REF_NAME || 'local'), ''];
function report(line) { summary.push(line); console.log(line); }
function publish() { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n'); }
process.on('exit', publish);
import { validateRepositories, inspectRepository } from '../src/supervisor-core.js';
import { prSummaryRows } from '../src/summary.js';
import { assessScheduleHistory, assessScheduleCadence, assessScheduleRevision } from '../src/schedule-health.js';
import { assessWorkflowState, scheduleDiagnosticHint, cadenceDiagnosticHint, scheduleSilenceHint, workflowActionsLink } from '../src/workflow-state.js';

const config = JSON.parse(readFileSync(new URL('../supervisor.config.json', import.meta.url)));
const repositories = validateRepositories(config).filter(entry => entry.enabled);
if (!repositories.length) {
  report('No hay repositorios habilitados.');
  process.exit(0);
}
if (!process.env.GH_TOKEN) throw new Error('GH_TOKEN missing: configure SUPERVISOR_GITHUB_TOKEN for other/private repositories');
async function get(path) {
  const res = await fetch('https://api.github.com' + path, {headers:{
    Authorization:'Bearer ' + process.env.GH_TOKEN,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'chatgpt-automation'
  }});
  if (!res.ok) throw new Error('GitHub API ' + res.status + ' at ' + path);
  return res.json();
}
// A manual green run does not prove that GitHub's cron is firing.
report('## Diagnóstico de ejecuciones programadas');
const ownRepo = process.env.GITHUB_REPOSITORY;
if (!/^[\w.-]+\/[\w.-]+$/.test(ownRepo || '')) {
  report('Estado: **desconocido** (GITHUB_REPOSITORY no disponible).');
} else {
  let workflowState = 'unknown';
  let scheduleState = 'unknown';
  try {
    const workflow = await get('/repos/' + ownRepo + '/actions/workflows/supervisor.yml');
    const configuration = assessWorkflowState(workflow);
    workflowState = configuration.state;
    report('- Workflow: **' + configuration.state + '** (' + configuration.reason + ').');
    const actionsLink = workflowActionsLink(workflow, ownRepo);
    if (actionsLink) report('- [Abrir workflow por ID de GitHub Actions](' + actionsLink + ') (enlace de navegación, no prueba de cron activo).');
    else report('- Identificador de workflow no disponible: no se puede generar un enlace de Actions verificable por ID.');
  } catch (error) {
    report('- Workflow: **unknown** (no se pudo consultar el estado de habilitación).');
    console.error('Workflow state unavailable:', String(error));
  }
  try {
    const history = await get('/repos/' + ownRepo + '/actions/workflows/supervisor.yml/runs?event=schedule&per_page=12');
    const latest = Array.isArray(history?.workflow_runs)
      ? { ...history, workflow_runs: history.workflow_runs.slice(0, 1) }
      : history;
    const health = assessScheduleHistory(latest);
    const cadence = assessScheduleCadence(history);
    scheduleState = health.state;
    report('- Estado: **' + health.state + '**.');
    const revision = assessScheduleRevision(history, process.env.GITHUB_SHA);
    if (revision.state === 'older-revision') {
      report('- Revisión del último schedule: **anterior** (\x60' + revision.runSha.slice(0, 7) + '\x60; revisión actual \x60' + revision.currentSha.slice(0, 7) + '\x60). No hay evidencia de un disparo schedule para la revisión actual; esto no demuestra que GitHub haya deshabilitado el cron.');
    } else if (revision.state === 'current-revision') {
      report('- Revisión del último schedule: **actual** (\x60' + revision.runSha.slice(0, 7) + '\x60).');
    } else if (revision.state === 'unknown') {
      report('- Revisión del último schedule: **desconocida** (' + revision.reason + ').');
    }
    const silenceHint = scheduleSilenceHint(health);
    if (silenceHint) report('- Aviso de ausencia reciente de disparos: ' + silenceHint);
    if (health.lastRunAt) {
      report('- Último disparo `schedule`: ' + health.lastRunAt + ' (' + health.ageMinutes + ' minutos).');
      report('- [Abrir ejecución](https://github.com/' + ownRepo + '/actions/runs/' + health.runId + ').');
    } else if (health.reason) report('- Motivo: ' + health.reason + '.');
    report('- Cadencia observada (' + (cadence.samples ?? 0) + ' disparos): **' + cadence.state + '**.');
    if (cadence.sampleWindow) {
      report('- Ventana de la muestra (UTC): ' + cadence.sampleWindow.oldest + ' → ' + cadence.sampleWindow.newest + '.');
    }
    if (cadence.limited) report('- Muestra limitada: ' + cadence.samples + ' de ' + cadence.totalRuns + ' disparos registrados; no se evalúan intervalos anteriores.');
    if (cadence.state === 'gaps' || cadence.state === 'no-large-gaps' || (cadence.state === 'insufficient-data' && cadence.samples >= 2)) {
      report('- Intervalos >15 min: ' + cadence.gaps + '; máximo observado: ' + cadence.maxGapMinutes + ' min.');
      if (cadence.gaps > 0 && cadence.largestGap) {
        report('- Mayor hueco: entre ' + cadence.largestGap.older + ' y ' + cadence.largestGap.newer + ' (UTC).');
        report('- Investigar extremos del hueco: [ejecución anterior](https://github.com/' + ownRepo + '/actions/runs/' + cadence.largestGap.olderRunId + ') y [ejecución posterior](https://github.com/' + ownRepo + '/actions/runs/' + cadence.largestGap.newerRunId + ').');
      }
    } else if (cadence.reason) report('- Motivo de cadencia: ' + cadence.reason + '.');
    const cadenceHint = cadenceDiagnosticHint(cadence);
    if (cadenceHint) report('- Comprobación de cadencia: ' + cadenceHint);
  } catch (error) {
    report('- Estado: **desconocido** (no se pudo consultar el historial de Actions).');
    console.error('Schedule history unavailable:', String(error));
  }
  const hint = scheduleDiagnosticHint(workflowState, scheduleState);
  if (hint) report('- Siguiente comprobación: ' + hint);
}
report('- Una ejecución reciente no garantiza una cadencia exacta de diez minutos.');
report('');

let errors = 0;
let totalPrs = 0;
const prDetails = [];
report('**Fuente:** API de GitHub. Un flujo programado puede ejecutarse con retraso.');
report('');
report('| Repositorio | PR abiertos | Verdes | Rojos | Pendientes | Desconocidos | Borradores |');
report('|---|---:|---:|---:|---:|---:|---:|');
for (const entry of repositories) {
  try {
    const observations = await inspectRepository(entry,get);
    for (const item of observations) console.log(JSON.stringify(item));
    prDetails.push(...prSummaryRows(observations));
    totalPrs += observations.length;
    const count = state => observations.filter(item => item.state === state).length;
    report('| ' + entry.full_name + ' | ' + observations.length + ' | ' + count('green') + ' | ' + count('red') + ' | ' + count('pending') + ' | ' + count('unknown') + ' | ' + count('draft') + ' |');
  } catch (error) {
    errors++;
    console.error(JSON.stringify({repo:entry.full_name,error:String(error)}));
    report('| ' + entry.full_name + ' | ERROR | — | — | — | — | — |');
  }
}
report('');
report('**Total de PR examinados:** ' + totalPrs + '. **Repositorios con error:** ' + errors + '.');
report('');
report('## Detalle de PR');
report('');
if (!prDetails.length) report('Sin PR abiertos detectados en los repositorios consultados correctamente.');
else {
  report('| PR | Commit | Estado |');
  report('|---|---|---|');
  for (const row of prDetails) report(row);
}
report('');
report('**Nota:** verde indica checks del PR, no ejecución automática del agente.');
if (errors) process.exitCode = 1;
