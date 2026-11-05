/**
 * The shape of /test-results.json: a compact summary of a Playwright run,
 * written by tests/support/results-reporter.ts and read by the Telemetry
 * section (src/scripts/testRun.ts).
 *
 * PRIVACY: public. Test titles, outcomes and timings only. No error messages,
 * absolute paths or traces. The one exception is visual tests: their
 * screenshots are of this public site itself, copied to dist/visual/.
 */
export type TestStatus = 'passed' | 'failed' | 'flaky' | 'skipped';

/** A visual test's images, as paths relative to /test-results.json. */
export interface TestShots {
  /** The approved image the test compares against. */
  baseline?: string;
  /** What this build looked like. */
  actual?: string;
  /** Pixels that differ (only when the comparison failed). */
  diff?: string;
}

export interface TestResult {
  /** Spec file, relative to tests/ (e.g. "start-sequence.spec.ts"). */
  file: string;
  /** describe() blocks, outermost first. */
  suite: string[];
  title: string;
  project: string;
  status: TestStatus;
  durationMs: number;
  /** Visual tests only. */
  shots?: TestShots;
}

export interface TestResultsSummary {
  generatedAt: string;
  status: 'passed' | 'failed' | 'timedout' | 'interrupted';
  durationMs: number;
  playwrightVersion: string;
  projects: string[];
  totals: Record<TestStatus, number> & { total: number };
  /** Present when the run happened in GitHub Actions. */
  ci?: { commit: string; runUrl: string };
  tests: TestResult[];
}

export function totalsOf(tests: TestResult[]): TestResultsSummary['totals'] {
  const totals = { total: tests.length, passed: 0, failed: 0, flaky: 0, skipped: 0 };
  for (const t of tests) totals[t.status]++;
  return totals;
}

/** 83_412 → "1m 23s"; 812 → "0.8s". */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
