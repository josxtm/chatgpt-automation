import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWorkflowState, scheduleDiagnosticHint, cadenceDiagnosticHint } from '../src/workflow-state.js';

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
