import { decide } from './decision.js';

export function validateRepositories(config) {
  if (!config || !Array.isArray(config.repositories)) throw new Error('Invalid repository configuration');
  const names = new Set();
  return config.repositories.map(entry => {
    if (!entry || typeof entry.full_name !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(entry.full_name) ||
        entry.full_name.split('/').some(part => part === '.' || part === '..')) {
      throw new Error('Invalid repository name');
    }
    // GitHub repository names are case-insensitive; avoid inspecting the same repo twice.
    const identity = entry.full_name.toLowerCase();
    if (names.has(identity)) throw new Error('Duplicate repository: ' + entry.full_name);
    names.add(identity);
    if (typeof entry.enabled !== 'boolean') throw new Error('Invalid enabled flag');
    if (!Array.isArray(entry.required_checks) || !entry.required_checks.length || entry.required_checks.some(n => typeof n !== 'string' || !n.trim()) || new Set(entry.required_checks).size !== entry.required_checks.length) throw new Error('Invalid required checks for ' + entry.full_name);
    return entry;
  });
}

// An empty inspection is not a successful supervision cycle.
// Disabled repositories are valid entries, but at least one must be active.
export function enabledRepositories(config) {
  const enabled = validateRepositories(config).filter(entry => entry.enabled);
  if (enabled.length === 0) throw new Error('No enabled repositories: refusing an empty successful inspection');
  return enabled;
}

export async function fetchPages(get, path, key, maxPages = 10) {
  const results = [];
  let expectedTotal = null;
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await get(path + sep + 'per_page=100&page=' + page);
    const batch = key ? data?.[key] : data;
    if (!Array.isArray(batch)) throw new Error('Invalid API page');
    if (key) {
      if (!Number.isSafeInteger(data.total_count) || data.total_count < 0) throw new Error('Missing total_count');
      // A changing total between pages is not a coherent check-run snapshot.
      // Never report green from a mixed or incomplete pagination window.
      if (expectedTotal !== null && data.total_count !== expectedTotal) {
        throw new Error('Inconsistent total_count across check pages');
      }
      expectedTotal = data.total_count;
    }
    results.push(...batch);
    if (key && results.length > data.total_count) throw new Error('Inconsistent total_count');
    if (batch.length < 100) {
      if (key && results.length !== data.total_count) throw new Error('Incomplete check runs');
      return results;
    }
  }
  throw new Error('Pagination limit reached: refusing incomplete decision');
}

export async function inspectRepository(entry, get) {
  const repo = entry.full_name;
  const prs = await fetchPages(get, '/repos/' + repo + '/pulls?state=open');
  // Pagination can repeat a PR when the open-PR list changes mid-request.
  // Validate the entire snapshot before querying checks or reporting a verdict.
  const seenPrNumbers = new Set();
  for (const pr of prs) {
    if (!Number.isSafeInteger(pr?.number) || pr.number <= 0 ||
        typeof pr?.head?.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(pr.head.sha) ||
        typeof pr.draft !== 'boolean') throw new Error('Malformed pull request');
    if (seenPrNumbers.has(pr.number)) throw new Error('Duplicate pull request number');
    seenPrNumbers.add(pr.number);
  }
  const observations = [];
  for (const pr of prs) {
    if (pr.draft) {
      observations.push({repo, pr:pr.number, sha:pr.head.sha, state:'draft'});
      continue;
    }
    const checks = await fetchPages(get, '/repos/' + repo + '/commits/' + pr.head.sha + '/check-runs', 'check_runs');
    observations.push({repo, pr:pr.number, sha:pr.head.sha, state:decide({draft:pr.draft,checks,expected:entry.required_checks})});
  }
  return observations;
}
