/**
 * Post-deploy smoke check: is the live site serving the commit that was just
 * pushed, and did that build's test run pass?
 *
 *   npm run smoke:live            # waits (up to 15 min) for the deploy to land
 *   npm run smoke:live -- --once  # check once, no waiting
 *
 * Every deploy publishes /test-results.json with the commit it was built from
 * (tests/support/results-reporter.ts), so the site can be asked what it is
 * running. This is the last step of the /ship workflow (.claude/skills/ship).
 * Read-only: two GET requests to the public site, nothing else.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SITE = 'https://harrybevan.uk/';
const WAIT_MS = 15 * 60_000;
const EVERY_MS = 20_000;

/**
 * Judge the live site against the commit we expect it to serve.
 * Returns the problems found; an empty list means the deploy is good.
 */
export function judge({ results, html, sha }) {
  const problems = [];
  const live = results?.ci?.commit;
  if (!live) problems.push('the live results don’t name a CI commit');
  else if (!sha.startsWith(live)) problems.push(`live is on ${live}, expected ${sha.slice(0, 7)}`);
  if (results?.status !== 'passed') problems.push(`the live test run is “${results?.status}”`);
  if (results?.totals?.failed) problems.push(`${results.totals.failed} tests failed in that run`);
  if (!results?.totals?.passed) problems.push('that run has no passing tests');

  const csp = html.match(/<meta[^>]+http-equiv="content-security-policy"[^>]*>/i)?.[0] ?? '';
  if (!csp) problems.push('the page has no Content-Security-Policy');
  else if (csp.includes('unsafe-inline')) problems.push('the CSP allows unsafe-inline');
  if (!html.includes('data-testid="skip-intro"')) problems.push('the page is missing Skip intro');
  return problems;
}

async function get(path) {
  // The query string dodges the CDN cache, so a fresh deploy is seen straight away.
  const res = await fetch(`${SITE}${path}?smoke=${Date.now()}`, {
    headers: { 'user-agent': 'portfolio-smoke-check' },
  });
  if (!res.ok) throw new Error(`${path || '/'} returned ${res.status}`);
  return res;
}

async function check(sha) {
  try {
    const [results, html] = await Promise.all([
      get('test-results.json').then((r) => r.json()),
      get('').then((r) => r.text()),
    ]);
    return { results, problems: judge({ results, html, sha }) };
  } catch (error) {
    return { problems: [error instanceof Error ? error.message : String(error)] };
  }
}

async function main() {
  const once = process.argv.includes('--once');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const deadline = Date.now() + (once ? 0 : WAIT_MS);
  console.log(`Checking ${SITE} for commit ${sha.slice(0, 7)}...`);

  for (;;) {
    const { results, problems } = await check(sha);
    if (problems.length === 0) {
      const t = results.totals;
      console.log(
        `✓ Live on ${results.ci.commit}: ${t.passed + t.flaky} passed, ${t.failed} failed, ${t.skipped} skipped.`,
      );
      return;
    }
    if (Date.now() >= deadline) {
      console.error(`✘ Not verified:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
      process.exitCode = 1;
      return;
    }
    console.log(`  not yet (${problems[0]}); checking again in ${EVERY_MS / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, EVERY_MS));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
