/**
 * Launch: lights out. The start screen's cockpit falls away into the live
 * first-person view, tyre smoke rolls up around the car, and the car pulls
 * up to the start/finish line (the roll itself is the lap's, see
 * src/animations/lap.ts). Then the hero copy arrives.
 */
import { gsap } from 'gsap';
import { TIMINGS } from './timings';
import { sound } from '../scripts/sound';
import { tyreSmoke } from './tyreSmoke';

export interface LaunchTargets {
  startScreen: HTMLElement;
  cockpit: HTMLElement;
  /** The car rolling up to the line in the driver view (none if the lap isn't ready). */
  rollIn?: gsap.core.Timeline;
  /** Tyre smoke layer (omitted under reduced motion). */
  smoke?: HTMLElement;
}

export function launch(els: LaunchTargets, reduced: boolean): gsap.core.Timeline {
  const l = TIMINGS.launch;
  const tl = gsap.timeline().call(() => sound.play('launch'));

  if (reduced) {
    return tl.to(els.startScreen, { autoAlpha: 0, duration: TIMINGS.reduced.exit });
  }

  return tl
    .to(
      els.cockpit,
      {
        scale: 1.12,
        opacity: 0,
        filter: 'blur(4px) brightness(1.2) saturate(1)',
        duration: l.cockpitExit,
        ease: 'power2.in',
      },
      0,
    )
    .to(els.startScreen, { autoAlpha: 0, duration: l.cockpitExit, ease: 'power1.in' }, 0.1)
    .add(els.rollIn ?? gsap.timeline(), 0)
    .add(els.smoke ? tyreSmoke({ layer: els.smoke }) : gsap.timeline(), 0);
}

export interface HeroTargets {
  words: HTMLElement[];
  lines: HTMLElement[];
  cue: HTMLElement | null;
}

/**
 * "Harry Bevan" rises in word by word, then the role and the scroll cue.
 * Explicit fromTo() end states, so the copy always finishes fully visible
 * whatever state the elements were in when the timeline was built.
 */
export function heroIn(els: HeroTargets, reduced: boolean): gsap.core.Timeline {
  const h = TIMINGS.hero;
  const tl = gsap.timeline();
  const lines = els.cue ? [...els.lines, els.cue] : els.lines;

  if (reduced) {
    return tl.fromTo(
      [...els.words, ...lines],
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: TIMINGS.reduced.fade },
    );
  }

  return tl
    .fromTo(
      els.words,
      { yPercent: 110 },
      { yPercent: 0, duration: h.words, stagger: h.wordStagger, ease: 'power4.out' },
    )
    .fromTo(
      lines,
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: h.role, stagger: 0.08, ease: 'power2.out' },
      '-=0.35',
    );
}
