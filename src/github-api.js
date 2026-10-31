// Validate the raw path before URL normalization: dot segments and encoded
// separators could otherwise escape the intended /repos/owner/repo scope.
function isSafeRepoApiPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/repos/') ||
      /[\u0000-\u001f\u007f\\#]/.test(path)) return false;
  const pathname = path.split('?')[0];
  const segments = pathname.slice(1).split('/');
  return segments.length >= 3 && segments[0] === 'repos' &&
    /^[A-Za-z0-9_.-]+$/.test(segments[1]) &&
    /^[A-Za-z0-9_.-]+$/.test(segments[2]) &&
    segments.slice(1).every(segment => segment !== '' && segment !== '.' && segment !== '..') &&
    !/%(?:2e|2f|5c|25)/i.test(pathname);
}

// All supervisor GitHub API calls are read-only and bounded in time.
// A stalled request must not consume the entire Actions job timeout.
export function createGithubGet(token, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof token !== 'string' || !token.trim()) throw new Error('GH_TOKEN missing');
  if (typeof fetchImpl !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('Invalid GitHub API client options');
  }
  return async function get(path) {
    if (!isSafeRepoApiPath(path)) {
      throw new TypeError('Invalid GitHub API path');
    }
    try {
      const res = await fetchImpl('https://api.github.com' + path, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'chatgpt-automation'
        }
      });
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
