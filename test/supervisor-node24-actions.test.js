import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('reusable supervisor uses Node 24-based official Actions without changing runtime or privileges', () => {
  const yaml = readFileSync(new URL('../.github/workflows/supervisor.yml', import.meta.url), 'utf8');
  assert.match(yaml, /^      - uses: actions\/checkout@v5$/m);
  assert.match(yaml, /^      - uses: actions\/setup-node@v5$/m);
  assert.match(yaml, /^          node-version: '22'$/m, 'application Node.js runtime remains 22');
  assert.doesNotMatch(yaml, /actions\/(?:checkout|setup-node)@v4/);
  assert.match(yaml, /^permissions:\r?\n  contents: read\r?\n  pull-requests: read\r?\n  checks: read\r?\n  actions: read$/m);
  assert.match(yaml, /^  group: multiproject-supervisor$/m);
  assert.match(yaml, /^  cancel-in-progress: false$/m);
});
