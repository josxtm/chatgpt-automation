import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The cron is configured in Actions, not in README. Keep the two operational
// descriptions synchronized with the actual schedule on this branch.
test('README describes the cron actually configured in Multiproject Supervisor', () => {
  const workflow = readFileSync(new URL('../.github/workflows/supervisor.yml', import.meta.url), 'utf8');
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const configured = workflow.match(/^\s*-\s*cron:\s*['"]([^'"]+)['"]\s*$/m);
  assert.ok(configured, 'expected one quoted schedule cron in supervisor.yml');

  const sections = readme.split(/^## /m);
  for (const heading of [
    'Cadencia cada diez minutos',
    'Verificación operativa del cron de 10 minutos'
  ]) {
    const section = sections.find(part => part.startsWith(heading));
    assert.ok(section, 'missing README section: ' + heading);
    assert.ok(
      section.includes('`' + configured[1] + '`'),
      heading + ' must describe the active cron ' + configured[1]
    );
  }
});
