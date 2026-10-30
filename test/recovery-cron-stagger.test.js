import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function scheduledMinutes(file) {
  const yaml = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8');
  const entries = [...yaml.matchAll(/^\s*- cron:\s*['"](\d+)-(\d+)\/(\d+) \* \* \* \*['"]\s*$/gm)];
  assert.equal(entries.length, 1, `${file} must declare exactly one hourly cron`);
  const [, from, to, step] = entries[0].map(Number);
  assert.equal(step, 10, `${file} must retain a ten-minute cadence`);
  assert.ok(from >= 0 && to < 60 && from <= to, `${file} must use valid minute bounds`);
  const minutes = [];
  for (let minute = from; minute <= to; minute += step) minutes.push(minute);
  assert.equal(minutes.length, 6, `${file} must offer six triggers per hour`);
  assert.equal(minutes.at(-1) + step - 60, minutes[0], `${file} must preserve spacing across hours`);
  return minutes;
}

test('recovery cron is staggered five minutes from the native cron without collisions', () => {
  const native = scheduledMinutes('supervisor.yml');
  const recovery = scheduledMinutes('supervisor-recovery.yml');
  assert.deepEqual(native, [3, 13, 23, 33, 43, 53]);
  assert.deepEqual(recovery, [8, 18, 28, 38, 48, 58]);
  const combined = [...native, ...recovery].sort((a, b) => a - b);
  assert.equal(new Set(combined).size, 12, 'native and recovery schedules must not collide');
  for (let i = 0; i < combined.length; i++) {
    const next = combined[(i + 1) % combined.length] + (i === combined.length - 1 ? 60 : 0);
    assert.equal(next - combined[i], 5, 'combined opportunities must be five minutes apart');
  }
});
