import { expect, test, type Page } from '@playwright/test';
import { skipSummary, type TestResultsSummary } from '../src/lib/testResults';
import type { TestCase } from '@playwright/test/reporter';
import { expectStage, skipIntro } from './helpers';
import { toResult } from './support/results-reporter';

/** A small, known run, so the Telemetry UI can be checked exactly. */
const fixture: TestResultsSummary = {
  generatedAt: '2026-11-04T12:00:00.000Z',
  status: 'passed',
  durationMs: 83_400,
  playwrightVersion: '1.64.1',
  projects: ['desktop-chromium', 'mobile-chromium'],
  totals: { total: 3, passed: 1, failed: 0, flaky: 1, skipped: 1 },
  ci: { commit: 'abc1234', runUrl: 'https://github.com/example/repo/actions/runs/1' },
  tests: [
    {
      file: 'start-sequence.spec.ts',
      suite: ['Start sequence'],
      title: 'guard then button reaches the track state',
      project: 'desktop-chromium',
      status: 'passed',
      durationMs: 8_100,
    },
    {
      file: 'start-sequence.spec.ts',
      suite: ['Lap extras'],
      title: 'desktop sector nav marks the current section',
      project: 'mobile-chromium',
      status: 'skipped',
      durationMs: 0,
      skipReason: 'The sector nav is desktop-only; mobile uses the mini-map.',
    },
    {
      file: 'accessibility.spec.ts',
      suite: ['Accessibility (axe)'],
      title: 'start screen has no serious or critical violations',
      project: 'mobile-chromium',
      status: 'flaky',
      durationMs: 2_300,
    },
  ],
};

async function driveToTelemetry(page: Page) {
  await page.goto('/');
  await skipIntro(page).click();
  await expectStage(page, 'track');
  await page.locator('#telemetry').scrollIntoViewIfNeeded();
}

/**
 * Wait for a run's closing summary line. (Waiting for "not running" can pass
 * before the run has even started, since live checks load their code first.)
 * The console streams lines over ~4.2s by design, so allow well past that.
 */
const runFinished = (page: Page, summary: string | RegExp) =>
  expect(page.getByTestId('test-console')).toContainText(summary, { timeout: 15_000 });

test.describe('Test ids', () => {
  for (const path of ['/', '/404.html']) {
    test(`every control on ${path} has a unique data-testid`, async ({ page }) => {
      await page.goto(path);
      const missing = await page
        .locator('button, a[href], summary')
        .evaluateAll((els) =>
          els.filter((el) => !el.hasAttribute('data-testid')).map((el) => el.outerHTML),
        );
      expect(missing).toEqual([]);

      const ids = await page
        .locator('[data-testid]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    });
  }
});

test.describe('Telemetry: live test results', () => {
  test('shows the latest CI results and replays the run', async ({ page }) => {
    await page.route('**/test-results.json', (route) => route.fulfill({ json: fixture }));
    await driveToTelemetry(page);

    await expect(page.locator('[data-test-run-status]')).toHaveText('All checks passed');
    await expect(page.locator('[data-total="passed"]')).toHaveText('2'); // passed + flaky
    await expect(page.locator('[data-total="skipped"]')).toHaveText('1');
    await expect(page.locator('[data-total="duration"]')).toHaveText('1m 23s');
    await expect(page.locator('[data-test-run-meta]')).toContainText('commit abc1234');
    await expect(page.getByTestId('test-run-ci')).toHaveAttribute('href', fixture.ci!.runUrl);

    await page.getByTestId('test-run-replay').click();
    await runFinished(page, '1 passed, 1 flaky, 1 skipped (1m 23s)');
    const output = page.getByTestId('test-console');
    await expect(output.locator('[data-status]')).toHaveCount(3);
    await expect(output.locator('[data-status="skipped"]')).toContainText('desktop sector nav');
    await expect(output).toContainText('1 passed, 1 flaky, 1 skipped (1m 23s)');
    await expect(page.locator('[data-announcer]')).toContainText('Replay finished');
  });

  test('each outcome total can list its tests', async ({ page }) => {
    await page.route('**/test-results.json', (route) => route.fulfill({ json: fixture }));
    await driveToTelemetry(page);
    const output = page.getByTestId('test-console');

    const skipped = page.getByTestId('test-run-view-skipped');
    await expect(skipped).toHaveAccessibleName('View tests that skipped');
    await skipped.click();
    await expect(skipped).toHaveAttribute('aria-pressed', 'true');
    await expect(output.locator('[data-status]')).toHaveCount(1);
    await expect(output.locator('[data-status="skipped"]')).toContainText('desktop sector nav');
    // Each skipped test carries the reason written in its spec.
    await expect(output.locator('[data-status="skipped"]')).toContainText(
      'skipped: The sector nav is desktop-only; mobile uses the mini-map.',
    );
    await expect(output).toBeFocused();
    await expect(page.locator('[data-announcer]')).toContainText('Showing 1 skipped test.');

    // Passed includes the flaky test (it passed on a retry), matching the total.
    await page.getByTestId('test-run-view-passed').click();
    await expect(skipped).toHaveAttribute('aria-pressed', 'false');
    await expect(output.locator('[data-status]')).toHaveCount(2);
    await expect(output.locator('[data-status="flaky"]')).toHaveCount(1);
  });

  test('failed and skipped links only show when the run has such tests', async ({ page }) => {
    let run = fixture;
    await page.route('**/test-results.json', (route) => route.fulfill({ json: run }));
    await driveToTelemetry(page);
    await expect(page.getByTestId('test-run-view-passed')).toBeEnabled();
    await expect(page.locator('[data-total="failed"]')).toHaveText('0');
    await expect(page.getByTestId('test-run-view-failed')).toBeHidden();
    await expect(page.getByTestId('test-run-view-skipped')).toBeVisible();

    run = {
      ...fixture,
      tests: [
        ...fixture.tests.filter((t) => t.status !== 'skipped'),
        { ...fixture.tests[0]!, title: 'a broken test', status: 'failed' },
      ],
    };
    await page.reload(); // the intro is remembered for the session
    await expectStage(page, 'track');
    await page.locator('#telemetry').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-total="failed"]')).toHaveText('1');
    await expect(page.locator('[data-total="skipped"]')).toHaveText('0');
    await expect(page.getByTestId('test-run-view-skipped')).toBeHidden();
    const failed = page.getByTestId('test-run-view-failed');
    await expect(failed).toBeEnabled();
    await failed.click();
    await expect(page.getByTestId('test-console').locator('[data-status]')).toHaveCount(1);
    await expect(page.getByTestId('test-console')).toContainText('a broken test');
  });

  test('a line under the totals says why tests were skipped', async ({ page }) => {
    // The fixture's skipped test never ran on any project: that is flagged, not excused.
    let run = fixture;
    await page.route('**/test-results.json', (route) => route.fulfill({ json: run }));
    await driveToTelemetry(page);
    const note = page.getByTestId('test-run-skip-note');
    await expect(note).toHaveText('1 of 1 skipped test did not run on any viewport.');
    await expect(note).toHaveAttribute('data-kind', 'warn');

    // Once the same test has passed on the other project, the skip is by design.
    const skipped = fixture.tests.find((t) => t.status === 'skipped')!;
    run = {
      ...fixture,
      tests: [
        ...fixture.tests,
        { ...skipped, project: 'desktop-chromium', status: 'passed', durationMs: 900 },
      ],
    };
    await page.reload();
    await expectStage(page, 'track');
    await page.locator('#telemetry').scrollIntoViewIfNeeded();
    await expect(note).toContainText('The 1 skip is by design');
    await expect(note).toHaveAttribute('data-kind', 'ok');

    // No skips, no line.
    run = { ...fixture, tests: fixture.tests.filter((t) => t.status !== 'skipped') };
    await page.reload();
    await expectStage(page, 'track');
    await page.locator('#telemetry').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-total="skipped"]')).toHaveText('0');
    await expect(note).toBeHidden();
  });

  test('skips only count as by design when the test passed on another project', () => {
    const base = fixture.tests[0]!;
    const skip = { ...base, project: 'mobile-chromium', status: 'skipped' as const };
    expect(skipSummary([base])).toBeNull();
    expect(skipSummary([base, skip])?.byDesign).toBe(true);
    // A twin that failed, or a different test, proves nothing.
    expect(skipSummary([{ ...base, status: 'failed' }, skip])?.byDesign).toBe(false);
    expect(skipSummary([{ ...base, title: 'another test' }, skip])?.byDesign).toBe(false);
    const two = skipSummary([base, skip, { ...skip, title: 'never run' }]);
    expect(two).toEqual({
      text: '1 of 2 skipped tests did not run on any viewport.',
      byDesign: false,
    });
  });

  test('the reporter publishes a skipped test’s own reason, and nothing for other outcomes', () => {
    const fake = (outcome: string, annotations: { type: string; description?: string }[]) =>
      ({
        title: 't',
        titlePath: () => ['', 'mobile-chromium', 'a.spec.ts', 'Suite', 't'],
        outcome: () => outcome,
        annotations,
        results: [{ duration: 12, annotations: [] }],
      }) as unknown as TestCase;
    const why = { type: 'skip', description: 'Pure logic: runs once, on desktop.' };
    expect(toResult(fake('skipped', [why]))).toMatchObject({
      status: 'skipped',
      skipReason: 'Pure logic: runs once, on desktop.',
    });
    expect(toResult(fake('skipped', [{ type: 'skip' }]))).not.toHaveProperty('skipReason');
    // Only a skip's reason is published: never an annotation from a test that ran.
    expect(toResult(fake('expected', [why]))).not.toHaveProperty('skipReason');
  });

  test('viewing tests scrolls the whole results box into view', async ({ page }) => {
    await page.route('**/test-results.json', (route) => route.fulfill({ json: fixture }));
    await driveToTelemetry(page);
    const view = page.getByTestId('test-run-view-passed');
    const output = page.getByTestId('test-console');
    await expect(view).toBeEnabled();

    // Leave the link at the very bottom of the screen, with the box below the fold.
    await view.evaluate((el) => {
      const top = el.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 8;
      window.scrollTo({ top, behavior: 'instant' });
    });
    await expect(output).not.toBeInViewport({ ratio: 1 });

    await view.click();
    // Clear of the mobile windscreen band too, which covers the top of the viewport.
    await expect
      .poll(() =>
        output.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
          return box.top >= pad && box.bottom <= window.innerHeight;
        }),
      )
      .toBe(true);
    await expect(output).toBeFocused();
  });

  test('live checks pass in the browser against the real page', async ({ page }) => {
    await driveToTelemetry(page);
    await page.getByTestId('test-run-live').click();
    await runFinished(page, /\d+ passed(, \d+ failed)? in your browser/);
    const output = page.getByTestId('test-console');
    await expect(output.locator('[data-status="passed"]')).toHaveCount(10);
    const failures = await output.locator('[data-status="failed"]').allInnerTexts();
    expect(failures).toEqual([]);
    await expect(output).toContainText('10 passed in your browser');
  });

  test('says so plainly when a build has no results', async ({ page }) => {
    await page.route('**/test-results.json', (route) => route.fulfill({ status: 404 }));
    await driveToTelemetry(page);
    await expect(page.locator('[data-test-run-status]')).toHaveText(
      'No test results in this build',
    );
    await expect(page.getByTestId('test-run-replay')).toBeDisabled();
    await expect(page.getByTestId('test-run-view-passed')).toBeDisabled();
    await expect(page.getByTestId('test-run-view-failed')).toBeHidden();
    await expect(page.getByTestId('test-run-view-skipped')).toBeHidden();
    await expect(page.getByTestId('test-run-live')).toBeEnabled();
  });

  test('visual tests open their screenshots from the test list', async ({ page }) => {
    const visual = (title: string, status: 'passed' | 'failed', diff = false) => ({
      file: 'visual.spec.ts',
      suite: ['Visual regression'],
      title,
      project: 'desktop-chromium',
      status,
      durationMs: 1_200,
      shots: {
        baseline: `visual/${title}-baseline.png`,
        actual: `visual/${title}-actual.png`,
        ...(diff ? { diff: `visual/${title}-diff.png` } : {}),
      },
    });
    const run: TestResultsSummary = {
      ...fixture,
      tests: [
        ...fixture.tests,
        visual('start screen', 'passed'),
        visual('404 page', 'failed', true),
      ],
    };
    // A 1×1 PNG stands in for every screenshot.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    await page.route('**/test-results.json', (route) => route.fulfill({ json: run }));
    await page.route('**/visual/*.png', (route) =>
      route.fulfill({ body: png, contentType: 'image/png' }),
    );
    await driveToTelemetry(page);

    await page.getByTestId('test-run-view-passed').click();
    const open = page.getByTestId('test-shots-desktop-chromium-start-screen');
    await expect(open).toHaveAccessibleName('📷 Screenshots for start screen, desktop-chromium');
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Screenshots: start screen' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('matches the baseline');
    await expect(dialog.getByRole('img')).toHaveCount(2);
    await expect(dialog.getByRole('img', { name: /^Baseline \(approved\)/ })).toBeVisible();
    await page.getByTestId('test-shots-close').click();
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();

    // A failed comparison also shows the diff.
    await page.getByTestId('test-run-view-failed').click();
    await page.getByTestId('test-shots-desktop-chromium-404-page').click();
    const failed = page.getByRole('dialog', { name: 'Screenshots: 404 page' });
    await expect(failed).toContainText('this build differs from the baseline');
    await expect(failed.getByRole('img', { name: /^Difference/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(failed).toBeHidden();
  });
});

test.describe('Break it', () => {
  test('a wheel comes off, live checks catch the planted bugs, and Fix it repairs both', async ({
    page,
  }) => {
    await driveToTelemetry(page);
    const breakIt = page.getByTestId('test-run-break');
    const output = page.getByTestId('test-console');
    const wheel = page.locator('[data-driver-hub="left"]');
    const wheelAt = () => wheel.evaluate((e) => e.getBoundingClientRect().toJSON());
    await expect(breakIt).toHaveAccessibleName(/Break it/);
    const fitted = await wheelAt();

    await breakIt.click();
    await expect(breakIt).toHaveAccessibleName(/Fix it/);
    await expect(output).toContainText('Front-left wheel off!');
    await expect(output).toContainText('3 real bugs were just planted');
    await expect(page.locator('[data-driver-gear]')).toHaveText('!');
    await expect(wheel).toHaveCSS('visibility', 'hidden', { timeout: 5_000 });
    await expect(page.locator('[data-announcer]')).toContainText('front-left wheel came off');

    // The live checks find all three bugs and name them.
    await page.getByTestId('test-run-live').click();
    await runFinished(page, '7 passed, 3 failed in your browser');
    const failures = output.locator('[data-status="failed"]');
    await expect(failures).toHaveCount(3);
    await expect(failures.nth(0)).toContainText('missing on: “Raw results (JSON)”');
    await expect(failures.nth(1)).toContainText('duplicated: hero-scroll-cue');
    await expect(failures.nth(2)).toContainText('h2 → h5');
    await expect(output).toContainText('Caught the planted bugs');

    // Fix it: the wheel goes back on and the page is exactly as it was.
    await breakIt.click();
    await expect(breakIt).toHaveAccessibleName(/Break it/);
    await expect(output).toContainText('Pit stop: wheel back on');
    await expect(page.locator('[data-driver-gear]')).toHaveText('7');
    await expect(wheel).toHaveCSS('visibility', 'visible');
    // ...and back on the car, exactly where it started (not just visible).
    await expect
      .poll(async () => {
        const now = await wheelAt();
        return Math.max(Math.abs(now.x - fitted.x), Math.abs(now.y - fitted.y));
      })
      .toBeLessThan(10);
    await expect(page.getByTestId('test-results-json')).toHaveCount(1);
    await expect(page.locator('#automation h3')).not.toHaveCount(0);
    await expect(page.locator('#automation h5')).toHaveCount(0);
    await page.getByTestId('test-run-live').click();
    await runFinished(page, '10 passed in your browser');
  });
});

test.describe('Telemetry without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('links to the raw results instead', async ({ page }) => {
    await page.goto('/#telemetry');
    await expect(page.getByTestId('test-results-json')).toBeVisible();
    await expect(page.getByTestId('test-run-replay')).toBeHidden();
  });
});
