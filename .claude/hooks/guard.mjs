/**
 * Guard: a PreToolUse hook for Claude Code (wired up in .claude/settings.json).
 * It reads the tool call as JSON on stdin and exits 2, with the reason on
 * stderr, to block it. The rules are the ones an agent must not be able to
 * talk itself out of:
 *
 *   Shell commands
 *     - no `git push`, `gh pr merge` or `gh workflow run`: a push to main
 *       deploys the live site, and that step stays with Harry
 *     - no `--no-verify`, `git reset --hard` or `git clean -f`
 *     - no raw `--update-snapshots` (use `npm run test:visual:update`, and
 *       only for a visual change the plan called for)
 *
 *   File edits
 *     - tests/: no `.only`, and no `.skip()` / `.fixme()` without a written
 *       reason, so "green" can't be reached by switching tests off
 *     - anything that ships or is documented (not tests/ or evals/, whose
 *       fixtures need fake details): no email address or phone number
 *     - src/: no inline `style="..."`, which the site's CSP would block
 *
 * The check functions are exported and unit-tested (tests/workflow.spec.ts).
 * A hook that crashes must never block work, so anything unexpected exits 0.
 */
import { pathToFileURL } from 'node:url';

/** Addresses that are allowed to appear: placeholders and no-reply senders. */
const SAFE_EMAIL = /^git@|@(?:example\.(?:com|org)|users\.noreply\.github\.com|anthropic\.com)$/i;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** UK numbers: +44…, or 01/02/03/07 followed by 8 or 9 more digits. */
const PHONE = /(?:\+44[\s-]?\d|\b0[1237]\d)(?:[\s-]?\d){8,9}\b/;

const COMMAND_RULES = [
  [
    // `push` as git's subcommand (after any -c/-C style flags), not a word in a commit message.
    /\bgit\s+(?:-\S+\s+(?:[^-\s]\S*\s+)?)*push\b/,
    'Pushing to main deploys the live site, so the push stays with Harry. Commit, then give him the command.',
  ],
  [
    /\bgh\s+(?:pr\s+merge|workflow\s+run)\b/,
    'Merging and running workflows on GitHub are Harry’s to do. Give him the command.',
  ],
  [/--no-verify\b/, 'Never skip commit hooks. Fix what the hook found.'],
  [
    /\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-z]*f/,
    'That discards work that can’t be recovered. Ask Harry first.',
  ],
  [
    /--update-snapshots\b|\bplaywright\b[^|;&]*\s-u\b/,
    'Don’t rewrite visual baselines to make a test pass. If the plan called for a visual change, use `npm run test:visual:update` and say so in the report.',
  ],
];

/** Why a shell command is blocked, or null if it may run. */
export function checkCommand(command) {
  for (const [pattern, reason] of COMMAND_RULES) {
    if (pattern.test(command)) return reason;
  }
  return null;
}

const inDir = (file, dir) => new RegExp(`(?:^|/)${dir}/`).test(file);

/** Why an edit is blocked, or null. `text` is the new content being written. */
export function checkEdit(filePath, text) {
  const file = filePath.replaceAll('\\', '/');

  if (inDir(file, 'tests')) {
    if (/\b(?:test|describe|it)\.only\b/.test(text)) {
      return 'No `.only` in tests: it silently stops the rest of the suite running.';
    }
    if (/\.(?:skip|fixme)\(\s*\)/.test(text)) {
      return 'A skipped test needs its reason written in the call, e.g. test.skip(isMobile, "why"). The reason is published with the results.';
    }
  }

  if (!inDir(file, 'tests') && !inDir(file, 'evals')) {
    const emails = (text.match(EMAIL) ?? []).filter((e) => !SAFE_EMAIL.test(e));
    if (emails.length > 0 || PHONE.test(text)) {
      return 'This repo is public: no email addresses or phone numbers, in the site, the code or the docs. Contact is LinkedIn only.';
    }
  }

  if (inDir(file, 'src') && /<[a-z][^>]*\sstyle\s*=\s*["'{]/i.test(text)) {
    return 'No inline style="..." in markup: the site’s CSP has no ‘unsafe-inline’, so it would be blocked. Use a class.';
  }

  return null;
}

/** The decision for one hook payload (the JSON Claude Code sends on stdin). */
export function decide(payload) {
  const input = payload?.tool_input ?? {};
  if (typeof input.command === 'string') return checkCommand(input.command);
  if (typeof input.file_path === 'string') {
    const text = [input.content, input.new_string, ...(input.edits ?? []).map((e) => e.new_string)]
      .filter((t) => typeof t === 'string')
      .join('\n');
    return checkEdit(input.file_path, text);
  }
  return null;
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const reason = decide(JSON.parse(raw));
  if (reason) {
    process.stderr.write(`Blocked by .claude/hooks/guard.mjs: ${reason}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => process.exit(0));
}
