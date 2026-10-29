import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWorkflowState } from '../src/workflow-state.js';

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
