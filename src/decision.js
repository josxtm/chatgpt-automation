export function decide({draft,checks,expected}) {
  if (draft) return 'draft';
  if (!Array.isArray(expected) || expected.length === 0) return 'unknown';
  if (!Array.isArray(checks)) return 'unknown';
  if (new Set(expected).size !== expected.length) return 'unknown';
  let pending = false;
  for (const name of expected) {
    const matches = checks.filter(c => c?.name === name);
    if (matches.length !== 1) return 'unknown';
    const c = matches[0];
    if (c.status !== 'completed') {
      if (c.status !== 'queued' && c.status !== 'in_progress' && c.status !== 'pending' && c.status !== 'waiting' && c.status !== 'requested') return 'unknown';
      // A pending check cannot already have a final conclusion. Fail closed.\n      if (c.conclusion != null) return 'unknown';\n      pending = true;
      continue;
    }
    if (c.conclusion === 'failure' || c.conclusion === 'timed_out' || c.conclusion === 'action_required' || c.conclusion === 'cancelled' || c.conclusion === 'startup_failure' || c.conclusion === 'stale') return 'red';
    if (c.conclusion !== 'success') return 'unknown';
  }
  return pending ? 'pending' : 'green';
}
