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
  // AbortSignal.timeout uses an unref'd timer; keep the event loop alive
  // while the mocked fetch waits, as a real HTTP socket would.
  const keepAlive = setTimeout(() => {}, 200);
  try {
    await assert.rejects(get('/repos/owner/repo/pulls'), /GitHub API timeout after 15ms/);
  } finally {
    clearTimeout(keepAlive);
  }
});

test('GitHub getter rejects invalid configuration and paths', async () => {
  assert.throws(() => createGithubGet(''), /GH_TOKEN/);
  assert.throws(() => createGithubGet('token', { timeoutMs: 0 }), /Invalid/);
  const get = createGithubGet('token', { fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(get('https://example.com/'), /Invalid GitHub API path/);
});

test('GitHub getter rejects traversal, encoded separators and ambiguous paths before fetch', async () => {
  let requests = 0;
  const get = createGithubGet('test-token', {
    fetchImpl: async () => {
      requests++;
      return { ok: true, json: async () => ({ ok: true }) };
    }
  });
  const invalid = [
    '/repos/owner/repo/../../user',
    '/repos/owner/repo/./pulls',
    '/repos/owner/repo/%2e%2e/user',
    '/repos/owner/repo/%2fuser',
    '/repos/owner/repo/%255cuser',
    '/repos/owner/repo\\..\\user',
    '/repos/owner/repo//pulls',
    '/repos/owner/repo/pulls#fragment',
    '/repos/owner/repo/pulls\nAuthorization: Bearer injected',
    '/repos/owner',
    '/repos//repo/pulls'
  ];
  for (const path of invalid) {
    await assert.rejects(get(path), /Invalid GitHub API path/, path);
  }
  assert.equal(requests, 0, 'invalid paths must not send an authenticated request');
  assert.deepEqual(
    await get('/repos/owner/repo/actions/workflows/supervisor.yml/runs?branch=main&per_page=100&page=1'),
    { ok: true },
    'normal read-only paginated API requests must still work'
  );
  assert.equal(requests, 1);
});
