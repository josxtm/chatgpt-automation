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

test('Supervisor CI validates all workflow YAML files with a checksum-pinned actionlint', () => {
  const yaml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(yaml, /Validate workflow syntax \(actionlint v1\.7\.12\)/);
  assert.match(yaml, /actionlint_1\.7\.12_linux_amd64\.tar\.gz/);
  assert.match(yaml, /8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8/);
  assert.match(yaml, /sha256sum --check --status/);
  assert.match(yaml, /actionlint" -shellcheck= -pyflakes= \.github\/workflows\/\*\.yml/);
  assert.match(yaml, /^permissions:\r?\n  contents: read\r?\njobs:/m,
    'linting must not broaden the CI token permissions');
});
