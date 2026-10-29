import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWorkflowState, scheduleDiagnosticHint, cadenceDiagnosticHint, scheduleSilenceHint } from '../src/workflow-state.js';

const workflow = { path: '.github/workflows/supervisor.yml', state: 'active' };

test('active workflow is enabled, not proof of scheduled execution', () => {
  assert.deepEqual(assessWorkflowState(workflow), {
    state: 'active', reason: 'habilitado en GitHub'
  });
});

test('GitHub disabled states are surfaced as disabled', () => {
  for (const state of ['disabled_manually', 'disabled_inactivity', 'disabled_fork']) {
    assert.equal(assessWorkflowState({ ...workflow, state }).state, 'disabled');
  }
});

test('deleted workflow is unavailable', () => {
  assert.equal(assessWorkflowState({ ...workflow, state: 'deleted' }).state, 'unavailable');
});

test('malformed, unrelated and unrecognized metadata fail closed', () => {
  for (const input of [null, {}, [], { ...workflow, path: '.github/workflows/ci.yml' }, { ...workflow, state: 'unexpected' }]) {
    assert.equal(assessWorkflowState(input).state, 'unknown');
  }
});

test('diagnostic guidance distinguishes disabled, absent and stale schedules', () => {
  assert.match(scheduleDiagnosticHint('disabled', 'never-seen'), /deshabilitado/);
  assert.match(scheduleDiagnosticHint('active', 'never-seen'), /sin disparos schedule/);
  assert.match(scheduleDiagnosticHint('active', 'stale'), /antiguo/);
  assert.match(scheduleDiagnosticHint('active', 'recent-not-green'), /jobs y logs/);
  assert.match(scheduleDiagnosticHint('active', 'stale-not-green'), /antiguo y no terminó en verde/);
  assert.match(scheduleDiagnosticHint('active', 'stale-not-green'), /jobs y logs/);
  assert.match(scheduleDiagnosticHint('active', 'stale-in-progress'), /cola, concurrencia y jobs/);
  assert.match(scheduleDiagnosticHint('unavailable', 'never-seen'), /eliminado/);
  assert.match(scheduleDiagnosticHint('unknown', 'never-seen'), /permisos actions:read/);
  assert.match(scheduleDiagnosticHint('active', 'unknown'), /historial schedule no es verificable/);
  assert.match(scheduleDiagnosticHint('active', 'in-progress'), /cola y jobs/);
  assert.equal(scheduleDiagnosticHint('active', 'observed'), null);
});

test('cadence guidance flags gaps even when the latest scheduled run succeeded', () => {
  assert.match(cadenceDiagnosticHint({state:'gaps',samples:4,gaps:1}), /huecos de más de diez minutos/);
  assert.match(cadenceDiagnosticHint({state:'insufficient-data',samples:2,gaps:1}), /huecos de más de diez minutos/);
  assert.match(cadenceDiagnosticHint({state:'insufficient-data',samples:1,gaps:0}), /pocos disparos/);
  assert.match(cadenceDiagnosticHint({state:'unknown'}), /no es verificable/);
  assert.match(cadenceDiagnosticHint(null), /No se pudo evaluar/);
  assert.equal(cadenceDiagnosticHint({state:'no-large-gaps',samples:12,gaps:0}), null);
  assert.equal(cadenceDiagnosticHint({state:'never-seen',samples:0}), null);
});

test('recent successful schedule is flagged when no newer trigger appears for over ten minutes', () => {
  assert.equal(scheduleSilenceHint({state:'observed',ageMinutes:10}), null);
  assert.match(scheduleSilenceHint({state:'observed',ageMinutes:11}), /más de diez minutos/);
  assert.equal(scheduleSilenceHint({state:'observed',ageMinutes:5}), null);
  assert.equal(scheduleSilenceHint({state:'observed',ageMinutes:15}, 15), null);
  assert.match(scheduleSilenceHint({state:'observed',ageMinutes:16}, 15), /más de 15 minutos/);
  assert.doesNotMatch(scheduleSilenceHint({state:'observed',ageMinutes:16}, 15), /diez minutos/);
  // Do not duplicate existing failure, stale, queue or unknown diagnostics.
  for (const state of ['stale', 'stale-not-green', 'in-progress', 'unknown', 'never-seen']) {
    assert.equal(scheduleSilenceHint({state,ageMinutes:30}), null);
  }
  assert.equal(scheduleSilenceHint({state:'observed',ageMinutes:NaN}), null);
  assert.equal(scheduleSilenceHint(null), null);
});
