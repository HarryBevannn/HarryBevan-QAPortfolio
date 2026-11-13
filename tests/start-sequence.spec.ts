import { expect, test } from '@playwright/test';
import {
  SEQUENCE_TIMEOUT,
  expectStage,
  guard,
  heroHeading,
  replayButton,
  skipIntro,
  soundToggle,
  startButton,
  trackErrors,
} from './helpers';
import { criteria, testCases } from '../src/data/testDesign';
import { guards, stages } from '../src/data/workflow';

test.describe('Start sequence', () => {
  test('page loads with no console errors, through the whole sequence', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expectStage(page, 'intro');
    await expect(page.getByText('Lift the guard to start')).toBeVisible();

    await guard(page).click();
    await startButton(page).click();
    await expectStage(page, 'track', SEQUENCE_TIMEOUT);

    // Drive to the chequered flag so the lazy-loaded lap code runs too.
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(page.locator('#contact')).toBeInViewport();
    expect(errors).toEqual([]);
  });

  test('the start screen names the site', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-start-screen]')).toContainText(
      'Lead Quality AI Engineer Portfolio',
    );
  });

  test('initial screen: Skip intro is the first focusable element', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(skipIntro(page)).toBeFocused();
    await expect(skipIntro(page)).toBeVisible();
    // The CV is hidden from the tab order while the intro is up.
    await expect(page.locator('[data-page]')).toHaveJSProperty('inert', true);
  });

  test('Skip intro jumps straight to the track/hero state', async ({ page }) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');
    await expect(page.locator('[data-start-screen]')).toBeHidden();
    await expect(heroHeading(page)).toBeVisible();
    await expect(heroHeading(page)).toBeFocused();
    await expect(page.locator('[data-announcer]')).toContainText('Intro skipped');
  });

  test('guard then button reaches the track state', async ({ page }) => {
    await page.goto('/');

    // START is locked under the guard.
    await expect(startButton(page)).toBeDisabled();
    await expect(guard(page)).toHaveAttribute('aria-expanded', 'false');

    // Step 1: lift the guard.
    await guard(page).click();
    await expectStage(page, 'armed');
    await expect(guard(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Press START', { exact: true })).toBeVisible();
    await expect(startButton(page)).toBeEnabled();
    await expect(page.locator('[data-announcer]')).toContainText('Safety guard lifted');

    // Step 2: press START.
    await startButton(page).click();
    await expectStage(page, 'starting');
    await expectStage(page, 'track', SEQUENCE_TIMEOUT);

    await expect(page.locator('[data-start-screen]')).toBeHidden();
    await expect(heroHeading(page)).toBeVisible();
    await expect(
      page.locator('#start').getByText('Lead Quality AI Engineer', { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('hero-scroll-cue')).toBeVisible();
    await expect(replayButton(page)).toBeVisible();
  });

  test('pressing START again mid-sequence does not restart it', async ({ page }) => {
    await page.goto('/');
    await guard(page).click();
    await startButton(page).click();
    await expectStage(page, 'starting');
    // START locks while the lights run; even a forced second click is ignored.
    await expect(startButton(page)).toBeDisabled();
    await startButton(page).dispatchEvent('click');
    await expectStage(page, 'track', SEQUENCE_TIMEOUT);
    await expect(page.locator('[data-announcer]')).not.toContainText('Engine starting');
    await page.waitForTimeout(500);
    await expectStage(page, 'track');
  });

  test('the guard can be lowered again before starting', async ({ page }) => {
    await page.goto('/');
    await guard(page).click();
    await expectStage(page, 'armed');
    // Lower it with the keyboard: deterministic, and it covers the keyboard path too.
    await guard(page).focus();
    await page.keyboard.press('Enter');
    await expectStage(page, 'intro');
    await expect(startButton(page)).toBeDisabled();
    await expect(guard(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('keyboard-only flow works end to end', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab'); // Skip intro
    await page.keyboard.press('Tab'); // Guard
    await expect(guard(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expectStage(page, 'armed');

    // Focus moves to START automatically.
    await expect(startButton(page)).toBeFocused();
    await page.keyboard.press('Space');
    await expectStage(page, 'track', SEQUENCE_TIMEOUT);

    await expect(heroHeading(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('hero-scroll-cue')).toBeFocused();
  });

  test('completed intro is remembered for the session, and can be replayed', async ({ page }) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');

    await page.reload();
    await expectStage(page, 'track');
    await expect(page.locator('[data-start-screen]')).toBeHidden();

    await replayButton(page).click();
    await expectStage(page, 'intro');
    await expect(page.locator('[data-start-screen]')).toBeVisible();
    await expect(guard(page)).toBeFocused();
  });

  test('sound is on by default, and muting is remembered', async ({ page }) => {
    await page.goto('/');
    const toggle = soundToggle(page);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-announcer]')).toContainText('Sound off');

    await page.reload();
    await expect(soundToggle(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('tyre smoke billows on launch, then clears away', async ({ page }) => {
    await page.goto('/');
    const smoke = page.locator('[data-smoke] .smoke__puff');
    await guard(page).click();
    await startButton(page).click();
    await expect(smoke.first()).toBeAttached({ timeout: SEQUENCE_TIMEOUT });
    await expectStage(page, 'track', SEQUENCE_TIMEOUT);
    await expect(smoke).toHaveCount(0, { timeout: 5_000 });
  });
});

test.describe('Scroll-driven lap', () => {
  test('the car moves round the track as the page scrolls', async ({ page }) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');

    const car = page.locator('[data-car]');
    const startTransform = await car.getAttribute('transform');

    await page.locator('#telemetry').scrollIntoViewIfNeeded();
    await expect(page.locator('#telemetry')).toHaveClass(/is-active/);
    await expect.poll(() => car.getAttribute('transform')).not.toBe(startTransform);
  });

  test('the first-person road is drawn and moves with the scroll', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');

    const road = page.locator('[data-road]');
    await expect(road).toBeVisible();
    const frame = () => road.evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png'));
    // Wait for the first frame (a blank canvas is a single colour, so it's tiny).
    await expect.poll(async () => (await frame()).length).toBeGreaterThan(5_000);
    const atStart = await frame();

    await page.locator('#telemetry').scrollIntoViewIfNeeded();
    await expect(page.locator('#telemetry')).toHaveClass(/is-active/);
    await expect.poll(frame).not.toBe(atStart);
    expect(errors).toEqual([]);
  });

  test('the mini-map follows the lap: passed sectors turn green', async ({ page }) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');

    await page.locator('#test-design').scrollIntoViewIfNeeded();
    await expect(page.locator('#test-design')).toHaveClass(/is-active/);
    for (const map of await page.locator('[data-minimap]').all()) {
      await expect(map.locator('[data-mini-marker="telemetry"]')).toHaveClass(/is-cleared/);
      await expect(map.locator('[data-mini-marker="test-design"]')).toHaveClass(/is-active/);
      await expect(map.locator('[data-mini-trail]')).not.toHaveCSS('stroke-dashoffset', '1px');
    }
  });

  test('after the flag the camera climbs out to the top-down map', async ({ page }) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');

    const driver = page.locator('[data-driver]');
    await expect(driver).toHaveCSS('opacity', '1');
    await page
      .locator('[data-lap-review]')
      .evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(page.getByRole('heading', { level: 2, name: 'The lap from above' })).toBeVisible();
    await expect(driver).toHaveCSS('opacity', '0');
    await expect(page.getByTestId('track-marker-telemetry')).toBeVisible();
  });
});

test.describe('Sound', () => {
  type AudioSpy = { __audio: { contexts: number; oscillators: number } };

  // Count AudioContexts and oscillators the page creates.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as AudioSpy & { AudioContext: typeof AudioContext };
      w.__audio = { contexts: 0, oscillators: 0 };
      const Original = w.AudioContext;
      w.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options);
          w.__audio.contexts++;
        }
        override createOscillator() {
          w.__audio.oscillators++;
          return super.createOscillator();
        }
      };
    });
  });

  const audioStats = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as unknown as AudioSpy).__audio);

  test('no audio is created and no AudioContext exists before any click', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2_500); // past the idle-time synth preload
    expect(await audioStats(page)).toEqual({ contexts: 0, oscillators: 0 });
  });

  test('no audio is created once muted', async ({ page }) => {
    await page.goto('/');
    await soundToggle(page).click(); // on → off
    await guard(page).click();
    await startButton(page).click();
    await expectStage(page, 'track', SEQUENCE_TIMEOUT);
    expect(await audioStats(page)).toEqual({ contexts: 0, oscillators: 0 });
  });

  test('with sound on (the default), the sequence plays audio without errors', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await guard(page).click();
    // The first sound starts on the visitor's own click.
    await expect.poll(async () => (await audioStats(page)).contexts).toBe(1);

    // Lights go red, then all five turn green for "go". The green phase is
    // brief, so record it in-page every frame rather than polling from Node.
    await page.evaluate(() => {
      const w = window as unknown as { __greenSeen: boolean };
      const green = document.querySelector('[data-glow="green"]')!;
      w.__greenSeen = false;
      const tick = () => {
        if (Number(getComputedStyle(green).opacity) > 0.9) w.__greenSeen = true;
        if (!w.__greenSeen && document.documentElement.dataset.stage !== 'track') {
          requestAnimationFrame(tick);
        }
      };
      tick();
    });
    await startButton(page).click();

    await expectStage(page, 'track', SEQUENCE_TIMEOUT);
    expect(
      await page.evaluate(() => (window as unknown as { __greenSeen: boolean }).__greenSeen),
    ).toBe(true);
    const { contexts, oscillators } = await audioStats(page);
    expect(contexts).toBe(1); // one shared context, reused for every cue
    expect(oscillators).toBeGreaterThan(5); // clicks, engine, countdown beeps
    expect(errors).toEqual([]);
  });

  test('the soundtrack keeps playing on the lap, and muting stops it', async ({ page }) => {
    const oscillators = async () => (await audioStats(page)).oscillators;
    await page.goto('/');
    await skipIntro(page).click(); // a click, so the soundtrack may start
    await expectStage(page, 'track');

    // The sequencer keeps scheduling notes (new oscillators) while it plays. It
    // follows the audio clock, which runs slow in headless Chromium under load.
    const first = await oscillators();
    await expect.poll(oscillators, { timeout: 15_000 }).toBeGreaterThan(first + 12);

    await soundToggle(page).click(); // mute
    await page.waitForTimeout(400); // let the last queued notes go
    const muted = await oscillators();
    await page.waitForTimeout(1_000);
    expect(await oscillators()).toBe(muted);
  });
});

test.describe('Lap extras', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipIntro(page).click();
    await expectStage(page, 'track');
  });

  test('the lap runs intro, the site testing itself, test design, the AI workflow, contact', async ({
    page,
  }) => {
    const ids = await page
      .locator('[data-lap-section]')
      .evaluateAll((els) => els.map((el) => el.id));
    expect(ids).toEqual(['start', 'telemetry', 'test-design', 'automation', 'contact']);
    await expect(page.getByTestId('hero-scroll-cue')).toHaveAttribute('href', '#telemetry');
    await expect(page.getByTestId('hero-contact')).toHaveAttribute('href', '#contact');
  });

  test('the hero shows only the title, and contact is LinkedIn only', async ({ page }) => {
    // No employer or location line under the title.
    await expect(page.locator('#start .hero__role')).toHaveText('Lead Quality AI Engineer');
    await expect(page.locator('#start .hero__meta')).toHaveCount(0);
    await page.locator('#contact').scrollIntoViewIfNeeded();
    const contact = page.locator('#contact .links a');
    await expect(contact).toHaveCount(1);
    await expect(contact).toHaveAccessibleName(/LinkedIn/);
  });

  test('the test design demo traces every criterion to its test cases', async ({ page }) => {
    const section = page.locator('#test-design');
    await section.scrollIntoViewIfNeeded();
    await page.getByTestId('test-design-tab-cases').click();
    await expect(section.locator('[data-test-case]')).toHaveCount(testCases.length);
    await expect(section.locator('[data-test-case]').first()).toBeVisible();
    await page.getByTestId('test-design-tab-coverage').click();
    for (const ac of criteria) {
      await expect(section.locator(`[data-coverage="${ac.id}"] td`)).toHaveText(/TC-\d+/);
      await expect(section.locator(`[data-coverage="${ac.id}"]`)).toBeVisible();
    }
  });

  test('the test design stages are tabs: one on screen, switched by click or arrow keys', async ({
    page,
  }) => {
    const section = page.locator('#test-design');
    await section.scrollIntoViewIfNeeded();
    const tab = (id: string) => page.getByTestId(`test-design-tab-${id}`);
    const panel = (id: string) => section.locator(`#td-stage-${id}`);

    await expect(section.getByRole('tablist', { name: 'Test design stages' })).toBeVisible();
    await expect(tab('requirement')).toHaveAttribute('aria-selected', 'true');
    await expect(panel('requirement')).toBeVisible();
    await expect(section.getByRole('tabpanel')).toHaveCount(1);
    await expect(section.getByRole('tabpanel')).toHaveAccessibleName(/Requirement/);

    await tab('analysis').click();
    await expect(tab('analysis')).toHaveAttribute('aria-selected', 'true');
    await expect(tab('requirement')).toHaveAttribute('aria-selected', 'false');
    await expect(panel('analysis')).toBeVisible();
    await expect(panel('requirement')).toBeHidden();

    // Arrow keys move along the tabs (and wrap); only the selected tab is in the tab order.
    await page.keyboard.press('ArrowRight');
    await expect(tab('cases')).toBeFocused();
    await expect(panel('cases')).toBeVisible();
    await page.keyboard.press('End');
    await expect(tab('coverage')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tab('requirement')).toBeFocused();
    await expect(tab('requirement')).toHaveAttribute('tabindex', '0');
    await expect(tab('coverage')).toHaveAttribute('tabindex', '-1');
    await expect(section.getByRole('tabpanel')).toHaveCount(1);
  });

  test('the AI workflow shows five gated stages, each linked to its file in the repo', async ({
    page,
  }) => {
    const section = page.locator('#automation');
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator('[data-stage-id]')).toHaveCount(stages.length);
    await expect(section.locator('[data-stage-id] h4')).toHaveText(stages.map((s) => s.name));
    for (const s of stages) {
      const link = page.getByTestId(`workflow-file-${s.id}`);
      await expect(link).toHaveAttribute('href', new RegExp(`/blob/main/${s.file}$`));
      await expect(link).toHaveAccessibleName(`${s.file} (opens in a new tab)`);
    }
    await expect(section.locator('[data-guard]')).toHaveCount(guards.length);
  });

  test('the HUD follows the lap and the finish shows a lap time', async ({ page }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(page.locator('#contact')).toHaveClass(/is-active/);
    await expect(page.locator('[data-lap-time]')).toHaveText(/^\d+:\d{2}\.\d{3}$/);
    await expect(page.locator('[data-hud-sector]')).toHaveText('Chequered flag');
  });

  test('track markers link into the page, and passed sectors turn green with a split', async ({
    page,
  }) => {
    const marker = page.getByTestId('track-marker-automation');
    await expect(marker).toHaveAccessibleName('Section 04: Plan to deploy, hands-free');
    await marker.click();
    await expect(page).toHaveURL(/#automation$/);
    await expect(page.locator('#automation')).toHaveClass(/is-active/);
    await expect(marker).toHaveClass(/is-active/);
    // Every marker behind the car is cleared; the car's own shows its split.
    await expect(page.getByTestId('track-marker-telemetry')).toHaveClass(/is-cleared/);
    await expect(page.getByTestId('track-marker-test-design')).toHaveClass(/is-cleared/);
    await expect(page.locator('[data-split="automation"]')).toHaveText(/^\d:\d{2}\.\d{2}$/);
  });

  test('scroll effects: titles wipe in as their section arrives', async ({ page }) => {
    await expect(page.locator('html')).toHaveClass(/lap-fx/);
    await expect(page.locator('#automation')).not.toHaveClass(/is-in/);
    await page.locator('#automation').scrollIntoViewIfNeeded();
    await expect(page.locator('#automation')).toHaveClass(/is-in/);
  });

  test('the speed reads on the steering wheel, not the pit wall, and rises with scrolling', async ({
    page,
  }) => {
    const speed = page.locator('[data-driver-speed]');
    await expect(speed).toHaveText('0');
    await expect(page.locator('[data-pitwall]')).not.toContainText('mph');
    await expect(page.locator('[data-hud-speed]')).toHaveCount(0);
    // Keep scrolling until the readout shows a speed.
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollBy(0, 240));
        return Number(await speed.textContent());
      })
      .toBeGreaterThan(0);
  });

  test('desktop sector nav marks the current section', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The sector nav is desktop-only; mobile uses the mini-map.');
    const link = page.getByTestId('sector-link-test-design');
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'location');
  });

  test('mobile: the road sits in a band above the text, never under it', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Desktop keeps the road beside the text.');
    const viewport = page.viewportSize()!;
    const band = (await page.locator('[data-driver]').boundingBox())!;
    expect(band.y).toBe(0);
    expect(band.height).toBeLessThan(viewport.height * 0.45);
    const bandBottom = band.y + band.height;

    // The hero starts below the band, and the Replay/Sound buttons sit inside it.
    const hero = (await heroHeading(page).boundingBox())!;
    expect(hero.y).toBeGreaterThanOrEqual(bandBottom);
    for (const id of ['replay-start', 'sound-toggle']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(bandBottom);
    }

    // Jumping to a section lands its title just below the band, not behind it.
    await page.evaluate(() => (location.hash = '#telemetry'));
    const title = page.locator('#telemetry h2');
    await expect
      .poll(async () => {
        const y = (await title.boundingBox())!.y;
        return y >= bandBottom && y < (viewport.height + bandBottom) / 2;
      })
      .toBe(true);
  });
});
