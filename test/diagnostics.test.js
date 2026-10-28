import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticPlan } from '../src/diagnostics.js';
const input={repo:'josxtm/chatgpt-automation',pr:6,sha:'a35575a868131d3c0f7ef1d9d229c44964a1f5d3',state:'red',expected:['test'],checks:[{name:'test',status:'completed',conclusion:'failure'}]};
test('proposes only a non-writing fix plan for confirmed red',()=>{
  const result=diagnosticPlan(input);
  assert.equal(result.action,'propose-fix');
  assert.equal(result.writeEnabled,false);
  assert.equal(result.requiresHumanApproval,true);
  assert.deepEqual(result.failed,[{name:'test',conclusion:'failure'}]);
});
test('does not propose fixes on green, missing or duplicate checks',()=>{
  assert.equal(diagnosticPlan({...input,state:'green'}).action,'none');
  assert.equal(diagnosticPlan({...input,checks:[]}).action,'manual-review');
  assert.equal(diagnosticPlan({...input,checks:[...input.checks,...input.checks]}).action,'manual-review');
});
test('rejects unsafe retry limits',()=>{
  assert.throws(()=>diagnosticPlan({...input,maxAttempts:4}),/retry/);
});
