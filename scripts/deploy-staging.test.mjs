import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/deploy-staging.sh (this file is plain JS next to the script, outside src/, because the frontend has no Node type definitions): deploys the tip of origin/staging as a PREVIEW, never production, and only moves the staging alias to a
// deployment Vercel reports as a Ready preview. Tested against a throwaway git repo and a stub of the Vercel CLI.

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'deploy-staging.sh');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();

let dir; let repo; let log; let stub; let tipSha;

/** A stub `vercel`: logs every call (with the git HEAD of its working copy) and answers like the real CLI. */
function writeStub(opts = {}) {
  const target = opts.target ?? 'preview'; const status = opts.status ?? '● Ready';
  fs.writeFileSync(stub, `#!/usr/bin/env bash
echo "CALL cwd_head=$(git rev-parse HEAD 2>/dev/null) :: $*" >> "${log}"
case "$1" in
  deploy) echo "Inspect: https://vercel.com/x"; echo "Preview: https://sato-frontend-abc123-lead-generation-io.vercel.app" ;;
  inspect)
    case "$2" in
      https://sato-frontend-staging.vercel.app) echo "    url		${opts.aliasUrl ?? 'https://sato-frontend-abc123-lead-generation-io.vercel.app'}" ;;
      *) printf '    target\\t%s\\n    status\\t%s\\n' "${target}" "${status}" ;;
    esac ;;
  alias) echo "Success!" ;;
esac
`, { mode: 0o755 });
}
const run = (...args) => spawnSync('bash', [SCRIPT, ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, VERCEL_BIN: stub } });
const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-staging-test-'));
  const origin = path.join(dir, 'origin.git'); repo = path.join(dir, 'repo'); log = path.join(dir, 'calls.log'); stub = path.join(dir, 'vercel');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'staging', origin]);
  execFileSync('git', ['clone', '-q', origin, repo]);
  git(repo, 'checkout', '-q', '-b', 'staging');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'staging tip\n'); git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'the tip of staging'); git(repo, 'push', '-q', 'origin', 'staging');
  tipSha = git(repo, 'rev-parse', 'HEAD');
  fs.mkdirSync(path.join(repo, '.vercel')); fs.writeFileSync(path.join(repo, '.vercel/project.json'), JSON.stringify({ projectId: 'prj_x', orgId: 'team_x', projectName: 'sato-frontend' }, null, 2));
  writeStub();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('scripts/deploy-staging.sh', () => {
  it('refuses --prod, --target and anything else it does not know, before calling Vercel at all', () => {
    for (const bad of ['--prod', '--production', '--target=production', 'production']) {
      const r = run(bad);
      expect(r.status, bad).not.toBe(0);
      expect(r.stderr).toMatch(/never deploys to production/);
    }
    expect(calls()).toEqual([]);
  });

  it('refuses when the repo is not linked to the sato-frontend project', () => {
    fs.writeFileSync(path.join(repo, '.vercel/project.json'), JSON.stringify({ projectName: 'sato-production' }));
    const r = run();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/not linked to sato-frontend/);
    expect(calls()).toEqual([]);
    fs.rmSync(path.join(repo, '.vercel'), { recursive: true });
    expect(run().stderr).toMatch(/no \.vercel\/project\.json/);
  });

  it('--dry-run runs the checks and changes nothing (no deploy, no alias)', () => {
    const r = run('--dry-run');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/dry run OK/);
    expect(calls()).toEqual([]);
  });

  it('deploys a CLEAN copy of origin/staging (not the local branch), as a preview, pointed at the staging backend, then moves the alias', () => {
    // local work that must NOT be deployed: an extra local commit and an uncommitted file
    fs.writeFileSync(path.join(repo, 'local-only.txt'), 'x'); git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'local only, not pushed');
    fs.writeFileSync(path.join(repo, 'uncommitted.txt'), 'secret');
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    const c = calls();
    const deploy = c.find((l) => l.includes(':: deploy'));
    expect(deploy).toContain(`cwd_head=${tipSha}`); // built from origin/staging's tip, not from the local branch
    expect(deploy).toContain('--build-env VITE_API_URL=https://sato-backend-staging-staging.up.railway.app');
    expect(deploy).toContain('--env VITE_API_URL=https://sato-backend-staging-staging.up.railway.app');
    expect(deploy).not.toMatch(/--prod|--target/);
    expect(deploy).toContain('--scope lead-generation-io');
    const order = c.map((l) => l.split(':: ')[1].split(' ')[0]);
    expect(order).toEqual(['deploy', 'inspect', 'alias', 'inspect']);
    expect(c.find((l) => l.includes(':: alias'))).toContain('alias set https://sato-frontend-abc123-lead-generation-io.vercel.app sato-frontend-staging.vercel.app');
    expect(r.stdout).toMatch(/now serves/);
  });

  it('does NOT move the alias when Vercel says the deployment is not a preview', () => {
    writeStub({ target: 'production' });
    const r = run();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/not a PREVIEW/);
    expect(calls().some((l) => l.includes(':: alias'))).toBe(false);
  });

  it('does NOT move the alias when the deployment is not Ready', () => {
    writeStub({ status: '● Building' });
    const r = run();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/not Ready/);
    expect(calls().some((l) => l.includes(':: alias'))).toBe(false);
  });

  it('fails loudly if the alias does not point at the new deployment afterwards', () => {
    writeStub({ aliasUrl: 'https://sato-frontend-someoldone-lead-generation-io.vercel.app' });
    const r = run();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/alias does not point at/);
  });

  it('leaves no temporary worktree behind', () => {
    run();
    expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
  });
});
