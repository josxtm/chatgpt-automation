import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRepositories } from '../src/supervisor-core.js';

// The README explicitly limits the initial GitHub-token scope to this repo.
// Expanding coverage must be an intentional, reviewed configuration change.
test('default supervisor configuration stays scoped to its own repository', () => {
  const config = JSON.parse(readFileSync(new URL('../supervisor.config.json', import.meta.url), 'utf8'));
  const repositories = validateRepositories(config);
  assert.equal(repositories.length, 1, 'additional repositories require explicit review');
  assert.deepEqual(repositories[0], {
    full_name: 'josxtm/chatgpt-automation',
    enabled: true,
    required_checks: ['test']
  }, 'no extra repositories, token fields, or unreviewed check policies');
});
