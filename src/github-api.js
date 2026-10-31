// All supervisor GitHub API calls are read-only and bounded in time.
// A stalled request must not consume the entire Actions job timeout.
export function createGithubGet(token, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof token !== 'string' || !token.trim()) throw new Error('GH_TOKEN missing');
  if (typeof fetchImpl !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('Invalid GitHub API client options');
  }
  return async function get(path) {
    if (typeof path !== 'string' || !path.startsWith('/repos/')) {
      throw new TypeError('Invalid GitHub API path');
    }
    try {
      const res = await fetchImpl('https://api.github.com' + path, {
        signal: AbortSignal.timeout(timeoutMs),
        // Never follow redirects with an authenticated request: a renamed or
        // unexpected endpoint must not silently change the inspected resource.
        redirect: 'error',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'chatgpt-automation'
        }
      });
      if (res.redirected) throw new Error('GitHub API redirect rejected at ' + path);
      if (!res.ok) throw new Error('GitHub API ' + res.status + ' at ' + path);
      return await res.json();
    } catch (error) {
      if (error?.name === 'TimeoutError') {
        throw new Error('GitHub API timeout after ' + timeoutMs + 'ms at ' + path, { cause: error });
      }
      throw error;
    }
  };
}
