/**
 * Engine start, in first person: the cockpit sharpens, the dials sweep to
 * maximum and back, warning lights blink on then off, the rev LEDs fire and
 * the camera rumbles. Then the five start lights come on and go out.
 */
import { gsap } from 'gsap';
import { TIMINGS } from './timings';
import { sound } from '../scripts/sound';

export interface CockpitTargets {
  cockpit: HTMLElement;
  shake: SVGGElement;
  needles: SVGGElement[];
  warnings: SVGElement[];
  revLeds: SVGGElement[];
}

const SHARP = 'blur(0px) brightness(1) saturate(1)';
const NEEDLE_MAX = 270; // matches SWEEP in Cockpit.astro

/** Ignition: everything on the dash comes alive. */
export function ignition(els: CockpitTargets, reduced: boolean): gsap.core.Timeline {
  const t = TIMINGS.ignition;
  const tl = gsap.timeline().call(() => sound.play('ignition'));

  if (reduced) {
    // Fades only: no sweep, no flashing, no shake.
    const r = TIMINGS.reduced;
    return tl
      .to(els.cockpit, { filter: SHARP, opacity: 1, duration: r.fade })
      .to(els.warnings, { opacity: 0.9, duration: r.fade }, '<')
      .to(els.revLeds, { opacity: 1, duration: r.fade }, '<')
      .to([...els.warnings, ...els.revLeds], { opacity: 0, duration: r.fade }, `+=${r.fade}`);
  }

  // Needles rotate around their dial centres.
  els.needles.forEach((n) => tl.set(n, { svgOrigin: `${n.dataset.cx} ${n.dataset.cy}` }, 0));

  return (
    tl
      // Blurred, dim cockpit snaps into focus.
      .to(
        els.cockpit,
        { filter: SHARP, opacity: 1, scale: 1, duration: t.sharpen, ease: 'power2.out' },
        0,
      )
      // Warning lamps blink on together...
      .to(els.warnings, { opacity: 0.95, duration: t.warningsOn, stagger: 0.02 }, 0.1)
      // ...the needle sweep...
      .to(els.needles, { rotation: NEEDLE_MAX, duration: t.needleUp, ease: 'power2.inOut' }, 0.25)
      .to(
        els.needles,
        { rotation: 0, duration: t.needleDown, ease: 'power2.inOut' },
        `>+${t.needleHold}`,
      )
      // ...rev LEDs fire left to right, hold, and clear from the right.
      .to(els.revLeds, { opacity: 1, duration: 0.05, stagger: t.revLedStagger }, 0.3)
      .to(
        els.revLeds,
        { opacity: 0, duration: 0.12, stagger: { each: t.revLedStagger / 2, from: 'end' } },
        `>+${t.revLedHold}`,
      )
      // ...and the warning lamps go out once the checks pass.
      .to(els.warnings, { opacity: 0, duration: 0.15, stagger: 0.03 }, 0.1 + t.warningsHold)
      // Engine catches: a short camera rumble.
      .to(
        els.shake,
        {
          x: () => gsap.utils.random(-t.rumbleAmount, t.rumbleAmount),
          y: () => gsap.utils.random(-t.rumbleAmount, t.rumbleAmount),
          duration: t.rumbleShake,
          repeat: t.rumbleRepeats,
          repeatRefresh: true,
          ease: 'none',
        },
        0.2,
      )
      .to(els.shake, { x: 0, y: 0, duration: 0.1 })
  );
}

/**
 * Five red lights illuminate one by one (a countdown beep each), hold, then
 * all switch to green with a "go" tone, and fade as the camera pulls away.
 */
export function startLights(pods: HTMLElement[], reduced: boolean): gsap.core.Timeline {
  const s = TIMINGS.startLights;
  const r = TIMINGS.reduced;
  const step = reduced ? r.lightStep : s.step;
  const glows = (colour: 'red' | 'green', pod?: HTMLElement) =>
    (pod ? [pod] : pods).flatMap((p) => [
      ...p.querySelectorAll<HTMLElement>(`[data-glow="${colour}"]`),
    ]);
  const tl = gsap.timeline();

  pods.forEach((pod, i) => {
    tl.to(glows('red', pod), { opacity: 1, duration: 0.06 }, (reduced ? 0 : s.leadIn) + i * step);
    tl.call(() => sound.play('light'), undefined, '<');
  });

  return tl
    .to(glows('red'), { opacity: 0, duration: 0.05 }, `+=${reduced ? r.lightsHold : s.hold}`)
    .to(glows('green'), { opacity: 1, duration: 0.05 }, '<')
    .call(() => sound.play('go'), undefined, '<')
    .to(glows('green'), {
      opacity: 0,
      duration: s.greenFade,
      delay: reduced ? r.greenHold : s.greenHold,
    });
}
