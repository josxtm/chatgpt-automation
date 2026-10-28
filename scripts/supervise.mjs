import { readFileSync, appendFileSync } from 'node:fs';

const started = new Date().toISOString();
const summary = ['# Multiproject Supervisor', '', '- Inicio (UTC): ' + started, '- Disparador: ' + (process.env.GITHUB_EVENT_NAME || 'local'), '- Rama: ' + (process.env.GITHUB_REF_NAME || 'local'), ''];
function report(line) { summary.push(line); console.log(line); }
function publish() { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n'); }
process.on('exit', publish);
import { validateRepositories, inspectRepository } from '../src/supervisor-core.js';
import { prSummaryRows } from '../src/summary.js';
import { assessScheduleHistory } from '../src/schedule-health.js';

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
  try {
    const history = await get('/repos/' + ownRepo + '/actions/workflows/supervisor.yml/runs?event=schedule&per_page=1');
    const health = assessScheduleHistory(history);
    report('- Estado: **' + health.state + '**.');
    if (health.lastRunAt) {
      report('- Último disparo `schedule`: ' + health.lastRunAt + ' (' + health.ageMinutes + ' minutos).');
      report('- [Abrir ejecución](https://github.com/' + ownRepo + '/actions/runs/' + health.runId + ').');
    } else if (health.reason) report('- Motivo: ' + health.reason + '.');
  } catch (error) {
    report('- Estado: **desconocido** (no se pudo consultar el historial de Actions).');
    console.error('Schedule history unavailable:', String(error));
  }
}
report('- Una ejecución reciente no garantiza una cadencia exacta de cinco minutos.');
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
