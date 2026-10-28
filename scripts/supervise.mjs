import { readFileSync } from 'node:fs';
import { decide } from '../src/decision.js';
const config = JSON.parse(readFileSync(new URL('../supervisor.config.json', import.meta.url)));
if (!Array.isArray(config.repositories)) throw new Error('Invalid repository configuration');
if (!process.env.GH_TOKEN) {
  console.log('Supervisor inactive: SUPERVISOR_GITHUB_TOKEN is not configured.');
  process.exit(0);
}
async function get(path) {
  const res = await fetch('https://api.github.com' + path, {headers:{
    Authorization: 'Bearer ' + process.env.GH_TOKEN,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'chatgpt-automation'
  }});
  if (!res.ok) throw new Error('GitHub API ' + res.status + ' at ' + path);
  return res.json();
}
async function pages(path, key) {
  const results = [];
  for (let page=1; page<=10; page++) {
    const sep=path.includes('?')?'&':'?';
    const data=await get(path+sep+'per_page=100&page='+page);
    const batch=key?data[key]:data;
    if (!Array.isArray(batch)) throw new Error('Invalid API page');
    results.push(...batch);
    if (batch.length<100) return results;
  }
  throw new Error('Pagination limit reached: refusing incomplete decision');
}
for (const entry of config.repositories) {
  if (!entry.enabled) continue;
  const repo=entry.full_name;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Invalid repository name');
  const required=entry.required_checks;
  const prs=await pages('/repos/'+repo+'/pulls?state=open');
  for (const pr of prs) {
    const sha=pr.head.sha;
    const checks=await pages('/repos/'+repo+'/commits/'+sha+'/check-runs','check_runs');
    const state=decide({draft:pr.draft,checks,expected:required});
    console.log(JSON.stringify({repo,pr:pr.number,sha,state}));
  }
}
