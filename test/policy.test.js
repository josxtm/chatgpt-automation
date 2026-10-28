import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequiredChecks } from '../src/policy.js';
import { decide } from '../src/decision.js';

test('accepts a distinct list of check names for a repository', () => {
  assert.deepEqual(parseRequiredChecks('["verify","lint"]'), ['verify','lint']);
});
test('missing or invalid configuration fails closed', () => {
  for (const raw of [undefined, null, '', 'verify', '{}', '[]', '["verify", "verify"]', '[" "]', '[123]']) {
    const expected = parseRequiredChecks(raw);
    assert.deepEqual(expected, []);
    assert.equal(decide({draft:false,checks:[{name:'verify',status:'completed',conclusion:'success'}],expected}), 'unknown');
  }
});
test('independent policies can produce different decisions', () => {
  const checks = [{name:'verify',status:'completed',conclusion:'success'}];
  assert.equal(decide({draft:false,checks,expected:parseRequiredChecks('["verify"]')}),'green');
  assert.equal(decide({draft:false,checks,expected:parseRequiredChecks('["lint"]')}),'unknown');
});
