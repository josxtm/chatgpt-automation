import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithubGet } from '../src/github-api.js';

test('GitHub getter sends read-only request with a bounded deadline', async () => {
  let seen;
  const get = createGithubGet('test-token', {
    fetchImpl: async (url, options) => {
      seen = { url, options };
      return { ok: true, json: async () => ({ total_count: 0, workflow_runs: [] }) };
    }
  });
  const result = await get('/repos/owner/repo/actions/workflows/supervisor.yml/runs?event=schedule');
  assert.equal(result.total_count, 0);
  assert.equal(seen.url, 'https://api.github.com/repos/owner/repo/actions/workflows/supervisor.yml/runs?event=schedule');
  assert.equal(seen.options.headers.Authorization, 'Bearer test-token');
  assert.equal(seen.options.headers.Accept, 'application/vnd.github+json');
  assert.equal(seen.options.signal.aborted, false);
  assert.equal(seen.options.method, undefined, 'must remain GET, never write');
});

test('GitHub getter fails closed on HTTP errors without leaking tokens', async () => {
  const get = createGithubGet('secret-not-for-logs', {
    fetchImpl: async () => ({ ok: false, status: 403 })
  });
  await assert.rejects(get('/repos/owner/repo/pulls'), error => {
    assert.match(error.message, /GitHub API 403/);
    assert.doesNotMatch(error.message, /secret-not-for-logs/);
    return true;
  });
});

test('GitHub getter aborts stalled requests and reports timeout', async () => {
  const get = createGithubGet('test-token', {
    timeoutMs: 15,
    fetchImpl: (_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    })
  });
  await assert.rejects(get('/repos/owner/repo/pulls'), /GitHub API timeout after 15ms/);
});

test('GitHub getter rejects invalid configuration and paths', async () => {
  assert.throws(() => createGithubGet(''), /GH_TOKEN/);
  assert.throws(() => createGithubGet('token', { timeoutMs: 0 }), /Invalid/);
  const get = createGithubGet('token', { fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(get('https://example.com/'), /Invalid GitHub API path/);
});
