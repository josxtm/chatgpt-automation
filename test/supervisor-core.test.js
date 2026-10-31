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
test('fails closed when check-run totals change between pages', async () => {
  const get = async path => /[?&]page=1(?:&|$)/.test(path)
    ? { total_count: 101, check_runs: Array.from({ length: 100 }, (_, i) => ({ name: 'other' + i })) }
    : { total_count: 102, check_runs: [
        { name: 'test', status: 'completed', conclusion: 'success' },
        { name: 'extra', status: 'completed', conclusion: 'success' }
      ] };
  await assert.rejects(fetchPages(get, '/checks', 'check_runs'), /Inconsistent total_count/);
});

test('inspects PR with exact expected check', async () => {
  const entry={full_name:'owner/repo',enabled:true,required_checks:['test']};
  const get=async path=>path.includes('/pulls?')?[{number:7,head:{sha:'a'.repeat(40)},draft:false}]:{total_count:1,check_runs:[{name:'test',status:'completed',conclusion:'success'}]};
  assert.deepEqual(await inspectRepository(entry,get),[{repo:'owner/repo',pr:7,sha:'a'.repeat(40),state:'green'}]);
});


test('rejects malformed PR metadata before requesting check runs', async () => {
  const entry = { full_name: 'owner/repo', enabled: true, required_checks: ['test'] };
  const valid = { number: 7, head: { sha: 'a'.repeat(40) }, draft: false };
  const invalid = [
    { ...valid, number: 0 },
    { ...valid, number: -1 },
    { ...valid, number: 1.5 },
    { ...valid, number: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, head: { sha: 'abc' } },
    { ...valid, head: { sha: 'g'.repeat(40) } },
    { ...valid, head: { sha: 'a'.repeat(39) + '/' } },
    { ...valid, draft: undefined },
    { ...valid, draft: 'false' },
    { ...valid, draft: null }
  ];
  for (const pr of invalid) {
    const calls = [];
    const get = async path => {
      calls.push(path);
      if (path.includes('/pulls?')) return [pr];
      throw new Error('Unexpected check-runs request');
    };
    await assert.rejects(inspectRepository(entry, get), /Malformed pull request/);
    assert.equal(calls.length, 1, 'must not fetch checks for malformed PR metadata');
  }
});

test('rejects duplicate PR numbers without querying checks', async () => {
  const entry = { full_name: 'owner/repo', enabled: true, required_checks: ['test'] };
  const pr = { number: 7, head: { sha: 'a'.repeat(40) }, draft: false };
  let checksRequested = 0;
  const get = async path => {
    if (path.includes('/pulls?')) return [pr, { ...pr, head: { sha: 'b'.repeat(40) } }];
    checksRequested++;
    throw new Error('Unexpected check-runs request');
  };
  await assert.rejects(inspectRepository(entry, get), /Duplicate pull request number/);
  assert.equal(checksRequested, 0);
});

test('rejects PR repeated across pagination boundaries before checking any PR', async () => {
  const entry = { full_name: 'owner/repo', enabled: true, required_checks: ['test'] };
  let checksRequested = 0;
  const get = async path => {
    if (path.includes('/pulls?')) {
      if (/[?&]page=1(?:&|$)/.test(path)) {
        return Array.from({ length: 100 }, (_, i) => ({
          number: i + 1, head: { sha: 'a'.repeat(40) }, draft: false
        }));
      }
      return [{ number: 1, head: { sha: 'b'.repeat(40) }, draft: false }];
    }
    checksRequested++;
    throw new Error('Unexpected check-runs request');
  };
  await assert.rejects(inspectRepository(entry, get), /Duplicate pull request number/);
  assert.equal(checksRequested, 0);
});


test('draft PR is reported without querying check runs', async () => {
  const entry={full_name:'owner/repo',enabled:true,required_checks:['test']};
  const calls=[];
  const get=async path=>{
    calls.push(path);
    if (path.includes('/pulls?')) return [{number:8,head:{sha:'a'.repeat(40)},draft:true}];
    throw new Error('Check-runs endpoint unavailable');
  };
  assert.deepEqual(await inspectRepository(entry,get),[{repo:'owner/repo',pr:8,sha:'a'.repeat(40),state:'draft'}]);
  assert.equal(calls.length,1, 'draft PR must not query check-runs');
});

test('non-draft PR still fails closed when check-runs API is unavailable', async () => {
  const entry={full_name:'owner/repo',enabled:true,required_checks:['test']};
  const get=async path=>{
    if (path.includes('/pulls?')) return [{number:9,head:{sha:'a'.repeat(40)},draft:false}];
    throw new Error('Check-runs endpoint unavailable');
  };
  await assert.rejects(inspectRepository(entry,get),/Check-runs endpoint unavailable/);
});