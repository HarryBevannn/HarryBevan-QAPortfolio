import { expect, type Page } from '@playwright/test';

/** The full sequence (press, ignition, lights, zoom) takes ~7s; allow headroom. */
export const SEQUENCE_TIMEOUT = 20_000;

export const stage = (page: Page) => page.locator('html');

export async function expectStage(page: Page, value: string, timeout = 5_000) {
  await expect(stage(page)).toHaveAttribute('data-stage', value, { timeout });
}

/**
 * Collects console errors and uncaught exceptions for the whole test.
 * One 404 is expected: /test-results.json only exists once a test run has
 * finished (the build wipes it), and the Telemetry section handles its absence.
 */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (msg.location().url.endsWith('/test-results.json')) return;
    errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

// Controls are located by data-testid (stable across copy and style changes).
// Their accessible names are asserted separately in accessibility.spec.ts.
export const skipIntro = (page: Page) => page.getByTestId('skip-intro');
export const guard = (page: Page) => page.getByTestId('guard');
export const startButton = (page: Page) => page.getByTestId('start-button');
export const replayButton = (page: Page) => page.getByTestId('replay-start');
export const soundToggle = (page: Page) => page.getByTestId('sound-toggle');
export const heroHeading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Harry Bevan' });
