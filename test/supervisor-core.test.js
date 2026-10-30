import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRepositories, fetchPages, inspectRepository } from '../src/supervisor-core.js';

test('rejects duplicate repositories and invalid required checks', () => {
  const good={full_name:'owner/repo',enabled:true,required_checks:['test']};
  assert.equal(validateRepositories({repositories:[good]}).length,1);
  assert.throws(()=>validateRepositories({repositories:[good,good]}),/Duplicate/);
  assert.throws(()=>validateRepositories({repositories:[{...good,required_checks:[]}]}),/Invalid required/);
});
test('rejects unsafe repository paths and case-insensitive duplicates', () => {
  const good = { full_name: 'Owner/Repo', enabled: true, required_checks: ['test'] };
  for (const full_name of ['../repo', './repo', 'owner/.', 'owner/..', 'owner/repo/other', 'owner//repo']) {
    assert.throws(() => validateRepositories({ repositories: [{ ...good, full_name }] }), /Invalid repository name/);
  }
  assert.throws(() => validateRepositories({ repositories: [good, { ...good, full_name: 'owner/repo' }] }), /Duplicate repository/);
  // A leading dot in a real repository name is valid; only "." and ".." are unsafe.
  assert.equal(validateRepositories({ repositories: [{ ...good, full_name: 'owner/.github' }] }).length, 1);
});
test('retrieves all check pages before deciding green', async () => {
  const get=async path=>/[?&]page=1(?:&|$)/.test(path)?{total_count:101,check_runs:Array.from({length:100},(_,i)=>({name:'other'+i}))}:{total_count:101,check_runs:[{name:'test',status:'completed',conclusion:'success'}]};
  assert.equal((await fetchPages(get,'/checks','check_runs')).length,101);
});
test('fails closed on truncated or malformed check results', async () => {
  await assert.rejects(fetchPages(async()=>({total_count:2,check_runs:[{name:'test'}]}),'/checks','check_runs'),/Incomplete/);
  await assert.rejects(fetchPages(async()=>({check_runs:[]}),'/checks','check_runs'),/total_count/);
  await assert.rejects(fetchPages(async()=>({total_count:1000,check_runs:Array(100).fill({})}),'/checks','check_runs',1),/limit/);
});
test('inspects PR with exact expected check', async () => {
  const entry={full_name:'owner/repo',enabled:true,required_checks:['test']};
  const get=async path=>path.includes('/pulls?')?[{number:7,head:{sha:'abc'},draft:false}]:{total_count:1,check_runs:[{name:'test',status:'completed',conclusion:'success'}]};
  assert.deepEqual(await inspectRepository(entry,get),[{repo:'owner/repo',pr:7,sha:'abc',state:'green'}]);
});
