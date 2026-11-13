/**
 * Format: a PostToolUse hook for Claude Code (wired up in
 * .claude/settings.json). After every Edit or Write it runs Prettier on the
 * file that changed, so the format check in `npm run verify` and CI can't
 * fail on an agent's edit. Files Prettier doesn't know, or that
 * .prettierignore lists, are left alone. It never blocks: any failure exits 0.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const prettier = fileURLToPath(
  new URL('../../node_modules/prettier/bin/prettier.cjs', import.meta.url),
);

try {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const payload = JSON.parse(raw);
  const file = payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;
  if (typeof file === 'string' && existsSync(file) && existsSync(prettier)) {
    execFileSync(process.execPath, [prettier, '--write', '--ignore-unknown', file], {
      cwd: root,
      stdio: 'ignore',
    });
  }
} catch {
  // Formatting is a convenience here; CI's format check is the gate.
}
