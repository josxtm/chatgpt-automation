import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('supervisor reports missing enabled repositories without credentials', () => {
  const result=spawnSync(process.execPath,['scripts/supervise.mjs'],{
    env:{...process.env,GH_TOKEN:''},encoding:'utf8'
  });
  assert.equal(result.status,1);
  assert.match(result.stderr,/GH_TOKEN missing/);
});
