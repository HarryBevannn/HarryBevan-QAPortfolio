/**
 * Ignition: the two visitor-operated steps on the start button.
 * Every function returns a GSAP timeline so the controller can sequence,
 * kill or revert it. Timings come from ./timings.ts.
 */
import { gsap } from 'gsap';
import { TIMINGS } from './timings';
import { sound } from '../scripts/sound';

/**
 * Step 1: the safety guard pops up off the console and swings out sideways on
 * its left-hand hinge (3D rotateY with a little tilt), overshoots and settles.
 * Reduced motion: a quick cross-fade into the open position.
 */
export function liftGuard(guard: HTMLElement, reduced: boolean): gsap.core.Timeline {
  const t = TIMINGS.guard;
  const tl = gsap.timeline().call(() => sound.play('guard'));

  if (reduced) {
    return tl
      .to(guard, { opacity: 0, duration: TIMINGS.reduced.fade / 2 })
      .set(guard, { rotationY: -t.openDeg })
      .to(guard, { opacity: 1, duration: TIMINGS.reduced.fade / 2 });
  }

  return tl
    .to(guard, {
      keyframes: {
        rotationY: [0, -t.overshootDeg * 0.25, -t.overshootDeg],
        rotationX: [0, t.liftTiltDeg, t.liftTiltDeg / 2],
        z: [0, t.liftZ, t.liftZ / 2],
        easeEach: 'sine.inOut',
      },
      duration: t.lift,
      ease: 'power2.out',
    })
    .to(guard, {
      rotationY: -t.openDeg,
      rotationX: 0,
      z: 0,
      duration: t.settle,
      ease: t.settleEase,
    });
}

/** Closes the guard again if the visitor changes their mind. */
export function lowerGuard(guard: HTMLElement, reduced: boolean): gsap.core.Timeline {
  const tl = gsap.timeline();

  if (reduced) {
    return tl
      .to(guard, { opacity: 0, duration: TIMINGS.reduced.fade / 2 })
      .set(guard, { rotationY: 0 })
      .to(guard, { opacity: 1, duration: TIMINGS.reduced.fade / 2 });
  }

  return tl.to(guard, {
    rotationY: 0,
    rotationX: 0,
    z: 0,
    duration: TIMINGS.guard.lower,
    ease: 'power2.in',
  });
}

interface PressTargets {
  button: HTMLElement;
  flash: HTMLElement;
  /** The whole button cluster, faded away after the press. */
  cluster: HTMLElement;
}

/**
 * Step 2: START visibly depresses, flashes, springs back, then the button
 * cluster fades so the dashboard can take over.
 */
export function pressStart(
  { button, flash, cluster }: PressTargets,
  reduced: boolean,
): gsap.core.Timeline {
  const t = TIMINGS.button;
  const tl = gsap.timeline().call(() => sound.play('press'));

  if (reduced) {
    return tl
      .to(flash, { opacity: 0.8, duration: 0.05 })
      .to(flash, { opacity: 0, duration: TIMINGS.reduced.fade })
      .to(cluster, { opacity: 0, duration: TIMINGS.reduced.fade });
  }

  return tl
    .to(button, { scale: 0.92, y: 3, duration: t.press, ease: 'power2.in' })
    .to(flash, { opacity: 1, duration: 0.05 }, '<+0.04')
    .to(button, { scale: 1, y: 0, duration: t.release, ease: 'back.out(3)' })
    .to(flash, { opacity: 0, duration: t.flash, ease: 'power2.out' }, '<')
    .to(cluster, { opacity: 0, scale: 0.88, y: 30, duration: t.exit, ease: 'power2.in' }, '+=0.1');
}
