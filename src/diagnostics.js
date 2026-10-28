const BAD = new Set(['failure','timed_out','action_required','cancelled']);
export function diagnosticPlan({repo,pr,sha,state,checks,expected,maxAttempts=3}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('Invalid repo');
  if (!Number.isInteger(pr) || pr < 1 || !/^[a-f0-9]{7,40}$/i.test(sha || '')) throw new Error('Invalid PR or SHA');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 0 || maxAttempts > 3) throw new Error('Invalid retry limit');
  if (state !== 'red') return {action:'none',reason:'Not a confirmed failed state'};
  if (!Array.isArray(checks) || !Array.isArray(expected) || !expected.length || new Set(expected).size !== expected.length) return {action:'manual-review',reason:'Incomplete policy'};
  const failed = [];
  for (const name of expected) {
    const matching = checks.filter(check => check?.name === name);
    if (matching.length !== 1) return {action:'manual-review',reason:'Ambiguous or missing check'};
    if (matching[0].status === 'completed' && BAD.has(matching[0].conclusion)) failed.push({name,conclusion:matching[0].conclusion});
  }
  if (!failed.length) return {action:'manual-review',reason:'No confirmed failed check'};
  return {action:'propose-fix',repo,pr,sha,failed,maxAttempts,requiresHumanApproval:true,writeEnabled:false};
}
