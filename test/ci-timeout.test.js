import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Supervisor CI has a bounded test-job runtime', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(
    yaml,
    /^  test:\r?\n    runs-on: ubuntu-latest\r?\n    timeout-minutes: 5\r?$/m,
    'CI must cap its test job at five minutes to avoid hanging indefinitely'
  );
  assert.match(yaml, /^        run: npm test\r?$/m);
});
