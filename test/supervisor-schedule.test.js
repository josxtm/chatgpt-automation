import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('scheduled supervisor uses a five-minute interval offset from the hour', () => {
  const yaml = readFileSync(new URL('../.github/workflows/supervisor.yml', import.meta.url), 'utf8');
  const match = yaml.match(/cron:\s*['"]?(\d+)-(\d+)\/(\d+) \* \* \* \*/);
  assert.ok(match, 'expected an explicit minute range and step');
  const [, start, end, step] = match.map(Number);
  assert.equal(step, 5);
  const minutes = [];
  for (let minute = start; minute <= end; minute += step) minutes.push(minute);
  assert.equal(minutes.length, 12, 'must schedule twelve times per hour');
  assert.ok(start > 0, 'avoid the top-of-hour scheduling hotspot');
  assert.equal(minutes.at(-1) + 5 - 60, minutes[0], 'five-minute spacing must hold across the hour');
  assert.match(yaml, /workflow_dispatch:/, 'manual diagnostic trigger must remain available');
  assert.match(yaml, /contents:\s*read/);
  assert.doesNotMatch(yaml, /wrangler|cloudflare/i);
});
