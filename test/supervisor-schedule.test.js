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
