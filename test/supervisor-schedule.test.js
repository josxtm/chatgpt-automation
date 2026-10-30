import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('scheduled supervisor uses a ten-minute interval offset from the hour', () => {
  const yaml = readFileSync(new URL('../.github/workflows/supervisor.yml', import.meta.url), 'utf8');
  const match = yaml.match(/cron:\s*['"]?(\d+)-(\d+)\/(\d+) \* \* \* \*/);
  assert.ok(match, 'expected an explicit minute range and step');
  const [, start, end, step] = match.map(Number);
  assert.equal(step, 10);
  const minutes = [];
  for (let minute = start; minute <= end; minute += step) minutes.push(minute);
  assert.equal(minutes.length, 6, 'must schedule six times per hour');
  assert.equal(start, 3, 'offset should avoid the top-of-hour scheduling hotspot');
  assert.equal(end, 53, 'schedule should cover the full hour');
  assert.equal(minutes.at(-1) + 10 - 60, minutes[0], 'ten-minute spacing must hold across the hour');
  assert.match(yaml, /workflow_dispatch:/, 'manual diagnostic trigger must remain available');
  assert.match(yaml, /contents:\s*read/);
  assert.doesNotMatch(yaml, /wrangler|cloudflare/i);
});

test('supervisor retains least-privilege read-only permissions and serialized runs', () => {
  const yaml = readFileSync(new URL('../.github/workflows/supervisor.yml', import.meta.url), 'utf8');
  const block = yaml.match(/^permissions:\r?\n((?:[ \t]+[^\r\n]*\r?\n)+)/m);
  assert.ok(block, 'supervisor must declare explicit workflow permissions');
  const permissions = block[1].trim().split(/\r?\n/).map(line => line.trim()).sort();
  assert.deepEqual(permissions, [
    'contents: read',
    'pull-requests: read',
    'checks: read',
    'actions: read'
  ].sort(), 'no write, token, or extra scopes may be added silently');
  assert.doesNotMatch(yaml, /^\s+permissions:/m, 'jobs must not override the read-only permission set');
  assert.match(yaml, /^concurrency:\r?\n {2}group: multiproject-supervisor\r?\n {2}cancel-in-progress: false(?:\r?\n|$)/m,
    'supervisor must serialize runs without cancelling an in-progress inspection');
  assert.doesNotMatch(yaml, /^\s*(?:pull_request_target|repository_dispatch|workflow_run):/m,
    'no privileged or chained triggers');
});

test('Supervisor CI retains read-only token permissions', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(yaml, /^permissions:\r?\n {2}contents: read\r?\n(?=jobs:)/m,
    'CI must have only contents: read');
  assert.doesNotMatch(yaml, /^\s+permissions:/m, 'jobs must not override CI permissions');
});
