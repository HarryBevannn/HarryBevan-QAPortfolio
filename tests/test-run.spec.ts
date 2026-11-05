import { expect, test, type Page } from '@playwright/test';
import type { TestResultsSummary } from '../src/lib/testResults';
import { expectStage, skipIntro } from './helpers';

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
    await expect(output).toBeFocused();
    await expect(page.locator('[data-announcer]')).toContainText('Showing 1 skipped test.');

    // Passed includes the flaky test (it passed on a retry), matching the total.
    await page.getByTestId('test-run-view-passed').click();
    await expect(skipped).toHaveAttribute('aria-pressed', 'false');
    await expect(output.locator('[data-status]')).toHaveCount(2);
    await expect(output.locator('[data-status="flaky"]')).toHaveCount(1);

    await page.getByTestId('test-run-view-failed').click();
    await expect(output.locator('[data-status]')).toHaveCount(0);
    await expect(output).toContainText('No tests failed in this run.');
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
    await expect(breakIt).toHaveAccessibleName(/Break it/);

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
    await expect(failures.nth(0)).toContainText('missing on: “GitHub”');
    await expect(failures.nth(1)).toContainText('duplicated: hero-scroll-cue');
    await expect(failures.nth(2)).toContainText('h2 → h5');
    await expect(output).toContainText('Caught the planted bugs');

    // Fix it: the wheel goes back on and the page is exactly as it was.
    await breakIt.click();
    await expect(breakIt).toHaveAccessibleName(/Break it/);
    await expect(output).toContainText('Pit stop: wheel back on');
    await expect(page.locator('[data-driver-gear]')).toHaveText('7');
    await expect(wheel).toHaveCSS('visibility', 'visible');
    await expect(page.getByTestId('footer-github')).toHaveCount(1);
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
