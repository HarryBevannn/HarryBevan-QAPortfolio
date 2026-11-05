import { existsSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectStage, skipIntro } from './helpers';

/**
 * Visual regression: key screens are compared with approved baselines
 * (visual.spec.ts-snapshots/, one set per OS, since fonts render slightly
 * differently on Windows and Linux). The results reporter publishes each
 * test's baseline and this build's capture (plus the diff, if it failed) so
 * the Telemetry section can show them.
 *
 * Reduced motion keeps every frame still: no backdrop drift, speed streaks or
 * reveals, so the same build always draws the same pixels. Anything that
 * changes between runs (lap clock, split times) is masked.
 *
 * Update baselines after an intended change: `npm run test:visual:update`
 * locally (Windows), and the "Update visual baselines" workflow for Linux.
 */
test.use({ reducedMotion: 'reduce' });

const masks = (page: Page) => [page.locator('[data-lap-time]'), page.locator('[data-split]')];

async function matches(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const options = { animations: 'disabled', caret: 'hide', mask: masks(page) } as const;
  await expect(page).toHaveScreenshot(name, { ...options, maxDiffPixelRatio: 0.01 });

  // Passed: publish the approved baseline and this build's capture side by side.
  const baseline = testInfo.snapshotPath(name, { kind: 'screenshot' });
  if (existsSync(baseline)) {
    await testInfo.attach('baseline', { path: baseline, contentType: 'image/png' });
  }
  await testInfo.attach('actual', {
    body: await page.screenshot(options),
    contentType: 'image/png',
  });
}

test.describe('Visual regression', () => {
  test('start screen', async ({ page }, testInfo) => {
    await page.goto('/');
    await expectStage(page, 'intro');
    await matches(page, testInfo, 'start-screen.png');
  });

  test('in the car at the start line', async ({ page }, testInfo) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');
    await matches(page, testInfo, 'start-line.png');
  });

  test('the lap from above', async ({ page }, testInfo) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');
    await page
      .locator('[data-lap-review]')
      .evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(page.getByTestId('track-marker-telemetry')).toBeVisible();
    await matches(page, testInfo, 'lap-from-above.png');
  });

  test('404 page', async ({ page }, testInfo) => {
    await page.goto('/404.html');
    await matches(page, testInfo, 'not-found.png');
  });
});
