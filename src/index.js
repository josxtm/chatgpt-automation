import { decide } from './decision.js';

const API = 'https://api.github.com';
async function github(path, token) {
  const response = await fetch(API + path, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'chatgpt-automation',
      Authorization: 'Bearer ' + token
    }
  });
  if (!response.ok) throw new Error('GitHub HTTP ' + response.status);
  return response.json();
}

async function inspect(repo, env) {
  const required = (env.REQUIRED_CHECKS || '').split(',').map(s => s.trim()).filter(Boolean);
  let page = 1;
  while (page <= 10) {
    const prs = await github('/repos/' + repo + '/pulls?state=open&per_page=100&page=' + page, env.GITHUB_TOKEN);
    for (const pr of prs) {
      const sha = pr.head.sha;
      const checks = await github('/repos/' + repo + '/commits/' + sha + '/check-runs?per_page=100', env.GITHUB_TOKEN);
      const state = decide({draft:pr.draft, checks:checks.check_runs, expected:required});
      await env.DB.prepare('INSERT OR IGNORE INTO observations(repo,pr,sha,state,details) VALUES(?,?,?,?,?)')
        .bind(repo,pr.number,sha,state,JSON.stringify(checks.check_runs.map(c=>({name:c.name,status:c.status,conclusion:c.conclusion})))).run();
    }
    if (prs.length < 100) break;
    page++;
  }
}

export default {
  async scheduled(_event, env, ctx) {
    if (env.AUTOMATION_ENABLED !== 'true' || !env.DB || !env.GITHUB_TOKEN) return;
    ctx.waitUntil((async () => {
      const now = Math.floor(Date.now()/1000);
      await env.DB.prepare('DELETE FROM leases WHERE expires_at < ?').bind(now).run();
      const lock = await env.DB.prepare('INSERT OR IGNORE INTO leases(lease_key,expires_at) VALUES(?,?)')
        .bind('cron',now+170).run();
      if (lock.meta.changes !== 1) return;
      try {
        const repos = await env.DB.prepare('SELECT full_name FROM repositories WHERE enabled=1').all();
        for (const row of repos.results) {
          try { await inspect(row.full_name,env); }
          catch (error) {
            await env.DB.prepare('INSERT INTO audit(repo,event,details) VALUES(?,?,?)')
              .bind(row.full_name,'monitor_error',String(error)).run();
          }
        }
      } finally {
        await env.DB.prepare('DELETE FROM leases WHERE lease_key=?').bind('cron').run();
      }
    })());
  },
  async fetch() {
    return new Response(JSON.stringify({service:'chatgpt-automation',mode:'read-only'}),{
      headers:{'content-type':'application/json'}
    });
  }
};
