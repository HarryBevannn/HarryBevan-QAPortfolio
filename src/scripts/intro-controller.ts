/**
 * Intro controller: the start sequence's state machine.
 *
 *   intro ──guard──▶ armed ──START──▶ starting ──(lights out, launch)──▶ track
 *     ▲                │
 *     └────guard───────┘          Skip intro: any stage ──▶ track
 *                                 Replay start: track ──▶ intro
 *
 * The stage lives on <html data-stage>, which CSS reads to show/hide the
 * start screen. The head script in BaseLayout sets the first stage before
 * paint (from sessionStorage), so returning visitors never see a flash.
 *
 * The lap (and its first-person road view) starts loading on START, so the
 * road is drawn behind the start screen by the time the lights go green.
 */
import { gsap } from 'gsap';
import { liftGuard, lowerGuard, pressStart } from '../animations/ignition';
import { ignition, startLights } from '../animations/engineStart';
import { heroIn, launch } from '../animations/launch';
import { TIMINGS } from '../animations/timings';
import { announce } from './announcer';
import { introMemory } from './storage';
import { prefersReducedMotion } from './motion';
import { sound } from './sound';
import type { LapControls } from '../animations/lap';

type Stage = 'intro' | 'armed' | 'starting' | 'track';

const HINT = {
  intro: 'Lift the guard to start',
  armed: 'Press START',
  starting: 'Engine starting…',
} as const;

function $<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Intro: missing ${selector}`);
  return el;
}

function $$<T extends Element>(selector: string): T[] {
  return [...document.querySelectorAll<T>(selector)];
}

export function initIntro(): void {
  const root = document.documentElement;
  const els = {
    startScreen: $<HTMLElement>('[data-start-screen]'),
    page: $<HTMLElement>('[data-page]'),
    guard: $<HTMLButtonElement>('[data-guard]'),
    button: $<HTMLButtonElement>('[data-start-button]'),
    flash: $<HTMLElement>('[data-start-flash]'),
    cluster: $<HTMLElement>('[data-ignition-wrap]'),
    hint: $<HTMLElement>('[data-hint]'),
    skip: $<HTMLAnchorElement>('[data-skip-intro]'),
    replay: $<HTMLButtonElement>('[data-replay]'),
    soundToggle: $<HTMLButtonElement>('[data-sound-toggle]'),
    soundState: $<HTMLElement>('[data-sound-state]'),
    heroTitle: $<HTMLElement>('[data-hero-title]'),
    cockpit: $<HTMLElement>('[data-cockpit]'),
    shake: $<SVGGElement>('[data-cockpit-shake]'),
    smoke: $<HTMLElement>('[data-smoke]'),
  };

  // All intro animation runs inside one context so Skip/Replay can revert it cleanly.
  let ctx = gsap.context(() => {});
  let lap: Promise<LapControls | null> | undefined;
  let lapControls: LapControls | null = null;
  const reduced = () => prefersReducedMotion();

  const stage = (): Stage => (root.dataset.stage as Stage | undefined) ?? 'intro';

  function setStage(next: Stage): void {
    root.dataset.stage = next;
    const onIntro = next !== 'track';
    els.page.inert = onIntro;
    els.startScreen.inert = !onIntro;
    els.replay.hidden = onIntro;
    els.button.disabled = next !== 'armed';
    els.guard.disabled = next === 'starting';
    els.guard.setAttribute('aria-expanded', String(next === 'armed' || next === 'starting'));
    if (next !== 'track') els.hint.textContent = HINT[next];
  }

  function loadLap(): Promise<LapControls | null> {
    lap ??= import('../animations/lap').then(({ initLap }) => (lapControls = initLap(reduced())));
    return lap;
  }

  /** Land on the track/hero state. Used at the end of the sequence and by Skip. */
  function enterTrack({ focus }: { focus: boolean }): void {
    setStage('track');
    introMemory.markComplete();
    void loadLap();
    if (focus) focusHero();
  }

  /**
   * Under reduced motion every property gets a 0.01ms transition (global.css),
   * so the page is still "hidden" for an instant after the stage changes and
   * focus can't land. Try now, then each frame until it has become visible
   * (three frames wasn't always enough on a busy machine; allow about half a second).
   */
  function focusHero(tries = 30): void {
    els.heroTitle.focus({ preventScroll: true });
    if (document.activeElement !== els.heroTitle && tries > 1) {
      requestAnimationFrame(() => focusHero(tries - 1));
    }
  }

  // ── Step 1: the guard ───────────────────────────────────────
  els.guard.addEventListener('click', () => {
    if (stage() === 'intro') {
      ctx.add(() => liftGuard(els.guard, reduced()));
      setStage('armed');
      announce('Safety guard lifted. Press START to start the engine.');
      els.button.focus();
    } else if (stage() === 'armed') {
      ctx.add(() => lowerGuard(els.guard, reduced()));
      setStage('intro');
      announce('Safety guard lowered.');
    }
  });

  // ── Step 2: START ───────────────────────────────────────────
  els.button.addEventListener('click', () => {
    if (stage() !== 'armed') return;
    setStage('starting');
    announce('Engine starting. Watch the start lights.');
    // Keep focus somewhere sensible while the controls are disabled.
    els.skip.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    // Start the lap now, so the road is drawn behind the start screen by lights out.
    void loadLap();

    const r = reduced();
    ctx.add(() => {
      const tl = gsap.timeline();
      tl.add(pressStart({ button: els.button, flash: els.flash, cluster: els.cluster }, r))
        .add(
          ignition(
            {
              cockpit: els.cockpit,
              shake: els.shake,
              needles: $$<SVGGElement>('[data-needle]'),
              warnings: $$<SVGElement>('[data-warning]'),
              revLeds: $$<SVGGElement>('[data-rev-led]'),
            },
            r,
          ),
          r ? '>' : '-=0.3',
        )
        .add(startLights($$<HTMLElement>('[data-start-light]'), r), r ? '>' : '-=0.6')
        .call(() => announce('Lights green. Go!'))
        // Build the launch lazily: the lap (and its road view) has loaded by now.
        .add(() => {
          ctx.add(() => {
            const go = launch(
              {
                startScreen: els.startScreen,
                cockpit: els.cockpit,
                rollIn: r ? undefined : lapControls?.rollIn(),
                // Tyre smoke on launch; none under reduced motion.
                smoke: r ? undefined : els.smoke,
              },
              r,
            );
            // The smoke outlasts the roll, so time the hero off the roll itself.
            const landed = r ? go.duration() : TIMINGS.launch.duration;
            const hero = heroIn(
              {
                words: $$<HTMLElement>('[data-hero-word]'),
                lines: $$<HTMLElement>('[data-hero-role]'),
                cue: document.querySelector<HTMLElement>('[data-hero-cue]'),
              },
              r,
            );
            gsap
              .timeline()
              .add(go)
              .add(hero, landed - (r ? 0 : TIMINGS.hero.overlap))
              .add(
                () => {
                  enterTrack({ focus: true });
                  announce(
                    `On track. ${els.heroTitle.textContent?.trim() ?? ''}. Scroll to drive.`,
                  );
                },
                r ? '>' : `-=${0.4}`,
              );
          });
        });
    });
  });

  // ── Skip intro ──────────────────────────────────────────────
  els.skip.addEventListener('click', (event) => {
    if (stage() === 'track') return; // normal "Skip to content" behaviour
    event.preventDefault();
    ctx.revert();
    ctx = gsap.context(() => {});
    sound.stopAll();
    els.smoke.replaceChildren();
    lapControls?.settle();
    enterTrack({ focus: true });
    sound.play('music'); // Skip is a click, so the soundtrack may start
    announce('Intro skipped. You’re on the start line.');
  });

  // ── Replay start ────────────────────────────────────────────
  els.replay.addEventListener('click', () => {
    ctx.revert();
    ctx = gsap.context(() => {});
    sound.stopAll();
    els.smoke.replaceChildren();
    window.scrollTo({ top: 0, behavior: 'instant' });
    lapControls?.settle();
    setStage('intro');
    announce('Back in the cockpit. Lift the guard to start.');
    els.guard.focus();
  });

  // ── Sound (on by default; the visitor's mute choice is remembered) ──
  const showSound = (on: boolean) => {
    els.soundToggle.setAttribute('aria-pressed', String(on));
    els.soundState.textContent = on ? 'on' : 'off';
  };
  showSound(sound.enabled);
  sound.onChange(showSound);
  els.soundToggle.addEventListener('click', () => {
    sound.setEnabled(!sound.enabled);
    // Switched back on while driving: bring the soundtrack back.
    if (sound.enabled && stage() === 'track') sound.play('music');
    announce(sound.enabled ? 'Sound on.' : 'Sound off.');
  });
  // Fetch the synth in idle time so the first click isn't late.
  const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 1500));
  idle(() => sound.preload());

  // ── Initial state ───────────────────────────────────────────
  if (stage() === 'track' || introMemory.isComplete()) {
    enterTrack({ focus: false });
  } else {
    window.scrollTo(0, 0);
    setStage('intro');
  }
}
