import { readFileSync } from 'node:fs';
import { validateRepositories, inspectRepository } from '../src/supervisor-core.js';

const config = JSON.parse(readFileSync(new URL('../supervisor.config.json', import.meta.url)));
const repositories = validateRepositories(config).filter(entry => entry.enabled);
if (!repositories.length) {
  console.log('No enabled repositories; supervisor has nothing to inspect.');
  process.exit(0);
}
if (!process.env.GH_TOKEN) throw new Error('GH_TOKEN missing: configure SUPERVISOR_GITHUB_TOKEN for other/private repositories');
async function get(path) {
  const res = await fetch('https://api.github.com' + path, {headers:{
    Authorization:'Bearer ' + process.env.GH_TOKEN,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'chatgpt-automation'
  }});
  if (!res.ok) throw new Error('GitHub API ' + res.status + ' at ' + path);
  return res.json();
}
let errors = 0;
for (const entry of repositories) {
  try {
    const observations = await inspectRepository(entry,get);
    for (const item of observations) console.log(JSON.stringify(item));
    console.log(JSON.stringify({repo:entry.full_name,open_prs:observations.length}));
  } catch (error) {
    errors++;
    console.error(JSON.stringify({repo:entry.full_name,error:String(error)}));
  }
}
if (errors) process.exitCode = 1;
