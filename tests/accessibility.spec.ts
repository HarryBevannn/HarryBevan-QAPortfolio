import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectStage, guard, heroHeading, skipIntro, startButton } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

test.describe('Accessibility (axe)', () => {
  test('start screen has no serious or critical violations', async ({ page }) => {
    await page.goto('/');
    await expectStage(page, 'intro');
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('armed state has no serious or critical violations', async ({ page }) => {
    await page.goto('/');
    await guard(page).click();
    await expectStage(page, 'armed');
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('track/CV state has no serious or critical violations', async ({ page }) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe('Accessible names', () => {
  // Tests locate controls by data-testid; this checks what assistive tech hears.
  test('every key control has the right accessible name', async ({ page }) => {
    await page.goto('/');
    const names: Record<string, string | RegExp> = {
      'skip-intro': 'Skip intro',
      guard: /Safety guard/,
      'start-button': 'Start engine',
      'sound-toggle': /^Sound/,
    };
    for (const [id, name] of Object.entries(names)) {
      await expect(page.getByTestId(id)).toHaveAccessibleName(name);
    }

    await skipIntro(page).click();
    await expectStage(page, 'track');
    await expect(page.getByTestId('replay-start')).toHaveAccessibleName(/Replay start/);
    await expect(page.getByTestId('hero-scroll-cue')).toHaveAccessibleName('Scroll to drive');
    // Below the fold: bring it in so the scroll reveal has shown it.
    await page.locator('#telemetry').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('test-run-replay')).toHaveAccessibleName(/Replay the CI run/);
    await expect(page.getByTestId('test-run-live')).toHaveAccessibleName(/Run live checks/);
  });
});

test.describe('Reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the content without the full animation', async ({ page }) => {
    await page.goto('/');
    await guard(page).click();

    // No 3D swing: the guard cross-fades into place.
    await expectStage(page, 'armed');
    await startButton(page).click();

    // The fade-only version is much quicker than the full ~7s sequence.
    await expectStage(page, 'track', 6_000);
    await expect(heroHeading(page)).toBeVisible();

    // No zoom was applied to the track and no shake to the cockpit.
    const zoomTransform = await page
      .locator('[data-track-zoom]')
      .evaluate((el) => getComputedStyle(el).transform);
    expect(zoomTransform === 'none' || zoomTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
    await expect(page.locator('[data-cockpit-shake]')).not.toHaveAttribute('transform', /./);
    // No tyre smoke, and none of the scroll effects (title wipes, parallax, car fx).
    await expect(page.locator('[data-smoke] .smoke__puff')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/lap-fx/);
    // The road view stays put: no lean, slide or pull-up, and no speed streaks.
    await expect(page.locator('[data-driver]')).toHaveCSS('opacity', '1');
    await expect(page.locator('.driver__rush')).toBeHidden();

    // Content reads as a normal page.
    for (const id of ['telemetry', 'test-design', 'automation', 'contact']) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`#${id} h2`)).toBeVisible();
    }
  });

  test('Skip intro moves focus to the hero, not back onto the skip link', async ({ page }) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');
    await expect(heroHeading(page)).toBeFocused();
  });
});

test.describe('Without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the portfolio is readable as a plain page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-start-screen]')).toBeHidden();
    await expect(heroHeading(page)).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'A portfolio that tests itself' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'From requirement to test cases' }),
    ).toBeAttached();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Let’s talk quality' }),
    ).toBeAttached();
    // Without JS the lap ends on the top-down circuit map.
    await expect(
      page.getByRole('heading', { level: 2, name: 'The lap from above' }),
    ).toBeAttached();
  });
});

test.describe('SEO & meta', () => {
  test('has title, description, canonical, social cards and a CSP', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Harry Bevan | Lead Quality AI Engineer Portfolio');
    const meta = (sel: string) => page.locator(sel).first().getAttribute('content');
    expect(await meta('meta[name="description"]')).toBeTruthy();
    expect(await meta('meta[property="og:image"]')).toBe(
      'https://harrybevannn.github.io/HarryBevan-QAPortfolio/og.png',
    );
    expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(await meta('meta[name="referrer"]')).toBe('strict-origin-when-cross-origin');
    const csp = await meta('meta[http-equiv="content-security-policy"]');
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://harrybevannn.github.io/HarryBevan-QAPortfolio/',
    );
  });

  test('never leaks a personal email address or phone number', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    const emails = html.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
    expect(emails.filter((e) => e !== 'hello@example.com')).toEqual([]);
    const text = await page.locator('body').innerText();
    expect(text.match(/(?:\+44\s?|\b0)\d(?:[\s-]?\d){8,10}/g)).toBeNull();
  });
});

test.describe('Portfolio, not a CV', () => {
  test('there is no CV page, PDF or download on the site', async ({ page, request }) => {
    expect((await request.get('/cv/')).status()).toBe(404);
    expect((await request.get('/cv.pdf')).status()).toBe(404);
    await page.goto('/');
    await expect(page.getByRole('link', { name: /\bCV\b/ })).toHaveCount(0);
    await expect(page.locator('a[href$=".pdf"], a[download]')).toHaveCount(0);
    for (const id of ['skills', 'career', 'experience']) {
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    }
  });
});
