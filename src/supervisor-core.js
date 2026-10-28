import { decide } from './decision.js';

export function validateRepositories(config) {
  if (!config || !Array.isArray(config.repositories)) throw new Error('Invalid repository configuration');
  const names = new Set();
  return config.repositories.map(entry => {
    if (!entry || typeof entry.full_name !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(entry.full_name)) throw new Error('Invalid repository name');
    if (names.has(entry.full_name)) throw new Error('Duplicate repository: ' + entry.full_name);
    names.add(entry.full_name);
    if (typeof entry.enabled !== 'boolean') throw new Error('Invalid enabled flag');
    if (!Array.isArray(entry.required_checks) || !entry.required_checks.length || entry.required_checks.some(n => typeof n !== 'string' || !n.trim()) || new Set(entry.required_checks).size !== entry.required_checks.length) throw new Error('Invalid required checks for ' + entry.full_name);
    return entry;
  });
}

export async function fetchPages(get, path, key, maxPages = 10) {
  const results = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await get(path + sep + 'per_page=100&page=' + page);
    const batch = key ? data?.[key] : data;
    if (!Array.isArray(batch)) throw new Error('Invalid API page');
    if (key && (!Number.isSafeInteger(data.total_count) || data.total_count < 0)) throw new Error('Missing total_count');
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
  const observations = [];
  for (const pr of prs) {
    if (!pr?.head?.sha || !Number.isInteger(pr.number)) throw new Error('Malformed pull request');
    const checks = await fetchPages(get, '/repos/' + repo + '/commits/' + pr.head.sha + '/check-runs', 'check_runs');
    observations.push({repo, pr:pr.number, sha:pr.head.sha, state:decide({draft:pr.draft,checks,expected:entry.required_checks})});
  }
  return observations;
}
