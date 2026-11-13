/**
 * THE /ship WORKFLOW: how a change to this site gets from a request to the
 * live site, shown in the "Plan to deploy, hands-free" lap section
 * (src/components/Workflow.astro).
 *
 * This describes real files in this repo: the skill, subagents and hooks under
 * .claude/, and scripts/smoke-live.mjs. tests/workflow.spec.ts checks that
 * every `file` here exists, that every guard rail listed is one the hook
 * really enforces, and that the stages match the skill, so the page can't
 * drift from the workflow.
 */

export interface WorkflowStage {
  id: string;
  name: string;
  /** Who or what does the work at this stage. */
  who: string;
  does: string;
  /** What must be true before the next stage starts. */
  gate: string;
  /** The file in this repo that defines the stage. */
  file: string;
}

export const command = '/ship';

export const stages: WorkflowStage[] = [
  {
    id: 'plan',
    name: 'Plan',
    who: 'Planner agent, read-only',
    does: 'Turns the request into acceptance criteria, risks and a named Playwright test for every criterion. It can read the code but can’t change it.',
    gate: 'Every criterion has a test',
    file: '.claude/agents/planner.md',
  },
  {
    id: 'build',
    name: 'Build',
    who: 'Claude Code, inside guard rails',
    does: 'Writes the planned tests first, then the smallest change that passes them. One hook formats every edit; another blocks the shortcuts listed below.',
    gate: 'Only the planned files changed',
    file: '.claude/hooks/guard.mjs',
  },
  {
    id: 'test',
    name: 'Test',
    who: 'ESLint, Playwright and axe',
    does: 'Lint, type checks, the build and the full suite on desktop and mobile: the same command CI runs. A failure means fixing the code, and after three failed attempts it stops and reports.',
    gate: 'npm run verify passes',
    file: '.claude/skills/ship/SKILL.md',
  },
  {
    id: 'verify',
    name: 'Verify',
    who: 'Verifier agent, fresh context',
    does: 'A second agent that never saw the build reads the diff, reruns the checks itself and marks each criterion pass or fail. The agent that wrote the change never signs it off.',
    gate: 'A pass on every criterion',
    file: '.claude/agents/verifier.md',
  },
  {
    id: 'deploy',
    name: 'Deploy',
    who: 'Me, then GitHub Actions',
    does: 'The agent commits and stops, because pushing is blocked for it. I push; CI reruns every check and deploys only a green run; then a smoke check asks the live site which commit it is serving.',
    gate: 'The live site reports the new commit',
    file: 'scripts/smoke-live.mjs',
  },
];

/**
 * What the guard hook stops the agent doing, whatever it has been asked.
 * Each id has a blocked example in tests/workflow.spec.ts.
 */
export const guards: { id: string; text: string }[] = [
  { id: 'push', text: 'Push or merge to main: deploying stays a human decision' },
  { id: 'tests-off', text: 'Switch a test off, or skip one without a written reason' },
  { id: 'baselines', text: 'Rewrite the visual baselines to hide a difference' },
  { id: 'hooks', text: 'Skip commit hooks or throw away uncommitted work' },
  { id: 'privacy', text: 'Add an email address or phone number to anything that ships' },
  { id: 'csp', text: 'Add an inline style the Content Security Policy would block' },
];
