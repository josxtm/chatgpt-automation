import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recovery = readFileSync(
  new URL('../.github/workflows/supervisor-recovery.yml', import.meta.url), 'utf8'
);

test('recovery ignores completed CI runs from an obsolete main revision', () => {
  // GitHub documents GITHUB_SHA for workflow_run as the default-branch tip.
  // A delayed completion for an older SHA must not cause an extra inspection.
  const condition = recovery.match(/^    if: >-\r?\n((?: {6,}[^\r\n]*\r?\n)+)/m);
  assert.ok(condition, 'expected a folded job-level if expression');
  assert.match(condition[1], /github\.event\.workflow_run\.head_sha\s*==\s*github\.sha/,
    'require the CI SHA to match the current default-branch SHA');
  assert.match(condition[1], /github\.event\.workflow_run\.head_repository\.full_name\s*==\s*github\.repository/,
    'retain same-repository protection');
  assert.match(condition[1], /github\.event\.workflow_run\.head_branch\s*==\s*'main'/,
    'retain main-only protection');
  assert.match(condition[1], /github\.event_name\s*!=\s*'workflow_run'\s*\|\|/,
    'do not restrict scheduled and manual recovery to CI events');
  assert.match(condition[1], /contains\(fromJSON\('\["push","workflow_dispatch"\]'\),\s*github\.event\.workflow_run\.event\)/,
    'continue excluding PR-triggered CI');
});

test('SHA guard does not widen recovery privileges or trigger types', () => {
  assert.match(recovery, /^permissions:\r?\n(?:  (?:contents|pull-requests|checks|actions): read\r?\n){4}/m);
  assert.doesNotMatch(recovery, /(?:contents|actions|checks|pull-requests): write|secrets: inherit|pull_request_target/);
  assert.match(recovery, /uses: \.\/\.github\/workflows\/supervisor\.yml/);
});
