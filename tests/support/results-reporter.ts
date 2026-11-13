import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import {
  totalsOf,
  type TestResult,
  type TestResultsSummary,
  type TestShots,
  type TestStatus,
} from '../../src/lib/testResults';

/**
 * Writes a compact summary of the run to dist/test-results.json, so the
 * deployed site can show the results of the run that shipped it (the
 * Telemetry section). CI only deploys after this suite passes.
 *
 * Titles, outcomes and timings only (plus each skipped test's own stated
 * reason): no error text, paths or attachments.
 * The one exception: visual tests (visual.spec.ts) get their screenshots,
 * which are of this public site, copied to dist/visual/ for the Telemetry
 * section's "Screenshots" dialog.
 */
const OUT_DIR = new URL('../../dist/', import.meta.url);
const SHOTS_DIR = 'visual/';
const VISUAL_SPEC = 'visual.spec.ts';

/**
 * Which image an attachment is. Passing visual tests attach "baseline" and
 * "actual" themselves; a failing comparison attaches Playwright's own
 * "<name>-expected.png", "<name>-actual.png" and "<name>-diff.png".
 */
function shotKind(name: string): keyof TestShots | null {
  if (name === 'baseline' || name.endsWith('-expected.png')) return 'baseline';
  if (name === 'actual' || name.endsWith('-actual.png')) return 'actual';
  if (name.endsWith('-diff.png')) return 'diff';
  return null;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Copy a visual test's images into dist/visual/; returns their paths for the JSON. */
function copyShots(test: TestCase, result: TestResult): TestShots | undefined {
  const shots: TestShots = {};
  for (const a of test.results.at(-1)?.attachments ?? []) {
    const kind = shotKind(a.name);
    if (!kind || a.contentType !== 'image/png' || !(a.path || a.body)) continue;
    const file = `${SHOTS_DIR}${slug(`${result.project} ${result.title}`)}-${kind}.png`;
    mkdirSync(new URL(SHOTS_DIR, OUT_DIR), { recursive: true });
    if (a.path) copyFileSync(a.path, new URL(file, OUT_DIR));
    else writeFileSync(new URL(file, OUT_DIR), a.body!);
    shots[kind] = file;
  }
  return Object.keys(shots).length ? shots : undefined;
}

const STATUS: Record<ReturnType<TestCase['outcome']>, TestStatus> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'flaky',
  skipped: 'skipped',
};

/** The reason given to test.skip() / test.fixme(), if the spec wrote one. */
function skipReason(test: TestCase): string | undefined {
  const annotations = [...test.annotations, ...(test.results.at(-1)?.annotations ?? [])];
  return annotations.find((a) => (a.type === 'skip' || a.type === 'fixme') && a.description)
    ?.description;
}

export function toResult(test: TestCase): TestResult {
  // titlePath: ['', project, file, ...describe blocks, test title]
  const [, project = '', file = '', ...rest] = test.titlePath();
  const title = rest.pop() ?? test.title;
  const status = STATUS[test.outcome()];
  const reason = status === 'skipped' ? skipReason(test) : undefined;
  return {
    file: file.replaceAll('\\', '/'),
    suite: rest,
    title,
    project,
    status,
    durationMs: Math.round(test.results.at(-1)?.duration ?? 0),
    ...(reason ? { skipReason: reason } : {}),
  };
}

export default class ResultsReporter implements Reporter {
  private config?: FullConfig;
  private suite?: Suite;

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
  }

  onEnd(result: FullResult): void {
    if (!this.suite || !existsSync(OUT_DIR)) return;
    const tests = this.suite.allTests().map((test) => {
      const result = toResult(test);
      const shots = result.file.endsWith(VISUAL_SPEC) ? copyShots(test, result) : undefined;
      return shots ? { ...result, shots } : result;
    });
    const env = process.env;
    const summary: TestResultsSummary = {
      generatedAt: new Date().toISOString(),
      status: result.status,
      durationMs: Math.round(result.duration),
      playwrightVersion: this.config?.version ?? '',
      projects: [...new Set(tests.map((t) => t.project))],
      totals: totalsOf(tests),
      ...(env.GITHUB_SHA && env.GITHUB_RUN_ID
        ? {
            ci: {
              commit: env.GITHUB_SHA.slice(0, 7),
              runUrl: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
            },
          }
        : {}),
      tests,
    };
    writeFileSync(new URL('test-results.json', OUT_DIR), JSON.stringify(summary));
  }

  printsToStdio(): boolean {
    return false;
  }
}
