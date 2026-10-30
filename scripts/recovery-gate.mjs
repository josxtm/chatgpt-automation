import { appendFileSync } from 'node:fs';
import { createGithubGet } from '../src/github-api.js';
import { shouldInspect } from '../src/recovery.js';
const inspect = await shouldInspect(createGithubGet(process.env.GITHUB_TOKEN), {
  repo: process.env.GITHUB_REPOSITORY,
  runId: Number(process.env.GITHUB_RUN_ID)
});
appendFileSync(process.env.GITHUB_OUTPUT, `inspect=${inspect}\n`);
appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nRecovery gate: ${inspect ? 'inspection due' : 'recent successful inspection; duplicate suppressed'}.\n`);
