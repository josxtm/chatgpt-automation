export function decide({draft,checks,expected}) {
  if (draft) return 'draft';
  if (!expected.length) return 'unknown';
  for (const name of expected) {
    const matches = checks.filter(c => c.name === name);
    if (matches.length !== 1) return 'unknown';
    const c = matches[0];
    if (c.status !== 'completed') return 'pending';
    if (c.conclusion !== 'success') return 'red';
  }
  return 'green';
}
