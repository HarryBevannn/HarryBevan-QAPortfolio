import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { guards, stages } from '../src/data/workflow';

/**
 * The /ship workflow (.claude/): the site describes it in the "Plan to deploy,
 * hands-free" section, so these tests keep that description honest. Every file
 * the page names must exist, the skill must run the stages the page lists, and
 * every guard rail the page claims must really be enforced by the hook.
 */
const root = new URL('../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), 'utf8');

interface Guard {
  checkCommand(command: string): string | null;
  checkEdit(filePath: string, text: string): string | null;
  decide(payload: unknown): string | null;
}
const GUARD = '.claude/hooks/guard.mjs';
const loadGuard = () => import(new URL(GUARD, root).href) as Promise<Guard>;

interface Smoke {
  judge(input: { results: unknown; html: string; sha: string }): string[];
}
const loadSmoke = () => import(new URL('scripts/smoke-live.mjs', root).href) as Promise<Smoke>;

type Call = { command: string } | { file: string; text: string };

// The hook guards this file too, so the calls it must block are assembled
// from parts: written out whole, the hook would refuse to save them here.
const call = (...parts: string[]) => parts.join('.');

/** A tool call the hook must block, for each guard rail the page lists. */
const BLOCKED: Record<string, Call[]> = {
  push: [
    { command: 'git push' },
    { command: 'git add -A && git push origin main' },
    { command: 'git -C . push --force' },
    { command: 'gh pr merge 12 --squash' },
  ],
  'tests-off': [
    { file: 'tests/lap.spec.ts', text: call('test', "only('the lap', async () => {});") },
    { file: 'C:\\site\\tests\\lap.spec.ts', text: call('test', 'describe', 'only("Lap", f);') },
    { file: 'tests/lap.spec.ts', text: call('test', 'skip' + '();') },
    { file: 'tests/lap.spec.ts', text: call('test', 'fixme' + '( );') },
  ],
  baselines: [
    { command: 'npx playwright test --update-snapshots' },
    { command: 'npx playwright test tests/visual.spec.ts -u' },
  ],
  hooks: [
    { command: 'git commit --no-verify -m "quick fix"' },
    { command: 'git reset --hard HEAD~1' },
    { command: 'git clean -fd' },
  ],
  privacy: [
    { file: 'src/data/site.ts', text: "email: 'someone@mail.test'," },
    { file: 'README.md', text: 'Call me on 07700 900123.' },
    { file: 'src/data/lap.ts', text: 'Phone: +44 7700 900123' },
  ],
  csp: [{ file: 'src/components/Hero.astro', text: '<p style="color: red">Hi</p>' }],
};

/** Ordinary work the hook must leave alone. */
const ALLOWED: Call[] = [
  { command: 'npm run verify' },
  { command: 'npx playwright test tests/workflow.spec.ts' },
  { command: 'git status --short' },
  { command: 'git commit -m "Stop the START button taking a second push"' },
  { command: 'npm run test:visual:update' },
  { file: 'tests/lap.spec.ts', text: "test.skip(isMobile, 'The sector nav is desktop-only.');" },
  { file: 'tests/evals.spec.ts', text: "passes('recruiter', 'It is someone@mail.test')" },
  { file: 'src/data/site.ts', text: "email: 'hello@example.com', themeColor: '#0a0a0b'" },
  { file: 'src/data/lap.ts', text: "auditNote: 'Measured 9 Nov 2026: 96, 100, 100, 100.'" },
  { file: 'src/components/Hero.astro', text: '<p class="hero__role">Lead</p>' },
  { file: 'README.md', text: 'Never write `style="..."` in markup.' },
];

const verdict = (guard: Guard, c: Call) =>
  'command' in c ? guard.checkCommand(c.command) : guard.checkEdit(c.file, c.text);

test.describe('The /ship workflow', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure logic: runs once, on desktop.');

  test('every stage on the page points at a real file in the repo', () => {
    expect(stages.map((s) => s.id)).toEqual(['plan', 'build', 'test', 'verify', 'deploy']);
    for (const s of stages) {
      expect(existsSync(new URL(s.file, root)), s.file).toBe(true);
    }
  });

  test('the skill runs the same five stages, in order, with the two subagents', () => {
    const skill = read('.claude/skills/ship/SKILL.md').replaceAll('\r\n', '\n');
    expect(skill).toMatch(/^---\nname: ship\n/);
    const headings = [...skill.matchAll(/^## \d\. (\w+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual(stages.map((s) => s.name));

    for (const agent of ['planner', 'verifier']) {
      expect(skill).toContain(`\`${agent}\` subagent`);
      expect(read(`.claude/agents/${agent}.md`)).toMatch(new RegExp(`^---\\r?\\nname: ${agent}`));
    }
    // It ends by handing the push to Harry and pointing at the smoke check.
    expect(skill).toContain('Do not push');
    expect(skill).toContain('npm run smoke:live');
    expect(JSON.parse(read('package.json')).scripts['smoke:live']).toBe(
      'node scripts/smoke-live.mjs',
    );
  });

  test('the planner can’t edit, and the verifier can’t fix what it finds', () => {
    const tools = (agent: string) =>
      read(`.claude/agents/${agent}.md`)
        .match(/^tools: (.+?)\r?$/m)![1]!
        .split(', ');
    expect(tools('planner')).toEqual(['Read', 'Grep', 'Glob']);
    expect(tools('verifier')).toEqual(['Read', 'Grep', 'Glob', 'Bash']);
  });

  test('the settings wire the guard before every command and edit, and deny pushing', () => {
    const settings = JSON.parse(read('.claude/settings.json'));
    const [pre] = settings.hooks.PreToolUse;
    for (const tool of ['Bash', 'PowerShell', 'Edit', 'Write']) {
      expect(pre.matcher.split('|'), tool).toContain(tool);
    }
    expect(pre.hooks[0].command).toContain(GUARD);
    const [post] = settings.hooks.PostToolUse;
    expect(post.matcher.split('|')).toEqual(expect.arrayContaining(['Edit', 'Write']));
    expect(post.hooks[0].command).toContain('.claude/hooks/format.mjs');
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(['Bash(git push *)', 'PowerShell(git push *)']),
    );
    expect(settings.permissions.allow.join(' ')).not.toMatch(/push|merge|reset|clean/);
  });

  test('every guard rail the page lists is enforced by the hook', async () => {
    const guard = await loadGuard();
    expect(Object.keys(BLOCKED).sort()).toEqual(guards.map((g) => g.id).sort());
    for (const { id } of guards) {
      for (const c of BLOCKED[id]!) {
        expect(verdict(guard, c), `${id}: ${JSON.stringify(c)}`).toEqual(expect.any(String));
      }
    }
  });

  test('the hook leaves ordinary work alone', async () => {
    const guard = await loadGuard();
    for (const c of ALLOWED) {
      expect(verdict(guard, c), JSON.stringify(c)).toBeNull();
    }
    // Edit, Write and MultiEdit payloads are all read; other tools pass straight through.
    expect(guard.decide({ tool_input: { file_path: 'tests/a.spec.ts', new_string: 'ok' } })).toBe(
      null,
    );
    expect(
      guard.decide({
        tool_input: { file_path: 'tests/a.spec.ts', edits: [{ new_string: call('it', 'only()') }] },
      }),
    ).toEqual(expect.any(String));
    expect(guard.decide({ tool_name: 'Read', tool_input: { pattern: 'x' } })).toBeNull();
  });

  test('run as a hook, it exits 2 with the reason, and never blocks on bad input', () => {
    const run = (stdin: string) =>
      spawnSync(process.execPath, [fileURLToPath(new URL(GUARD, root))], {
        input: stdin,
        encoding: 'utf8',
      });
    const blocked = run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push' } }));
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toContain('the push stays with Harry');

    const allowed = run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm test' } }));
    expect(allowed.status).toBe(0);
    expect(run('not json').status).toBe(0);
  });

  test('the smoke check passes only when the live site serves the pushed commit, green', async () => {
    const { judge } = await loadSmoke();
    const sha = 'abc1234def5678900000000000000000000000ff';
    const html =
      '<meta http-equiv="content-security-policy" content="default-src \'self\'">' +
      '<a data-testid="skip-intro" href="#main">Skip intro</a>';
    const results = {
      status: 'passed',
      totals: { passed: 120, failed: 0, flaky: 0, skipped: 15 },
      ci: { commit: 'abc1234' },
    };
    expect(judge({ results, html, sha })).toEqual([]);

    // Still serving the previous deploy.
    expect(judge({ results: { ...results, ci: { commit: '0ld5ha1' } }, html, sha })).toEqual([
      'live is on 0ld5ha1, expected abc1234',
    ]);
    // A local build (no CI commit) or a red run is never "verified".
    expect(judge({ results: { ...results, ci: undefined }, html, sha })).toHaveLength(1);
    expect(
      judge({
        results: { ...results, status: 'failed', totals: { ...results.totals, failed: 2 } },
        html,
        sha,
      }),
    ).toEqual(['the live test run is “failed”', '2 tests failed in that run']);
    // The page itself: CSP present and strict, and the content there.
    expect(judge({ results, html: '<p>Maintenance</p>', sha })).toEqual([
      'the page has no Content-Security-Policy',
      'the page is missing Skip intro',
    ]);
    expect(judge({ results, html: html.replace("'self'", "'unsafe-inline'"), sha })).toEqual([
      'the CSP allows unsafe-inline',
    ]);
  });
});
