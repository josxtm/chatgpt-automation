import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRepositories, fetchPages, inspectRepository } from '../src/supervisor-core.js';

test('rejects duplicate repositories and invalid required checks', () => {
  const good={full_name:'owner/repo',enabled:true,required_checks:['test']};
  assert.equal(validateRepositories({repositories:[good]}).length,1);
  assert.throws(()=>validateRepositories({repositories:[good,good]}),/Duplicate/);
  assert.throws(()=>validateRepositories({repositories:[{...good,required_checks:[]}]}),/Invalid required/);
});
test('retrieves all check pages before deciding green', async () => {
  const get=async path=>path.includes('page=1')?{total_count:101,check_runs:Array.from({length:100},(_,i)=>({name:'other'+i}))}:{total_count:101,check_runs:[{name:'test',status:'completed',conclusion:'success'}]};
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
