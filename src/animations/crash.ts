/**
 * "Break it" (Telemetry): the front-left wheel comes off. It hops off the
 * hub and bounces away down the road ahead, the suspension droops, the car lurches onto that
 * corner with sparks scraping off the road, and the gear display shows "!".
 * "Fix it" sends the pit crew in: the wheel flies back on and everything
 * settles. Reduced motion: the wheel just fades out and back.
 *
 * Works on the cockpit in DriverView.astro (data-driver-hub, -arm, -sparks,
 * -gear). Loaded on demand by src/scripts/testRun.ts.
 */
import { gsap } from 'gsap';
import { TIMINGS } from './timings';

const TYRE_CENTRE = '315 725'; // SVG coordinates of the left tyre's centre
const ARM_ROOT = '716 700'; // where the left wishbones meet the nose
/** Where the escaped wheel ends up: far down the road, near the vanishing point. */
const AWAY = { x: 470, y: -640, scale: 0.05 };

function parts() {
  const layer = document.querySelector<HTMLElement>('[data-driver]');
  return {
    layer,
    frame: layer?.querySelector<HTMLElement>('[data-driver-frame]') ?? null,
    hub: layer?.querySelector<SVGGElement>('[data-driver-hub="left"]') ?? null,
    arm: layer?.querySelector<SVGGElement>('[data-driver-arm="left"]') ?? null,
    sparks: layer?.querySelector<SVGGElement>('[data-driver-sparks]') ?? null,
    gear: layer?.querySelector<SVGTextElement>('[data-driver-gear]') ?? null,
  };
}

let tl: gsap.core.Timeline | undefined;

export function crash(reduced: boolean): void {
  const { layer, frame, hub, arm, sparks, gear } = parts();
  if (!hub) return;
  const c = TIMINGS.crash;
  tl?.kill();
  if (gear) gear.textContent = '!';
  if (reduced) {
    tl = gsap.timeline().to(hub, { autoAlpha: 0, duration: 0.3 });
    return;
  }
  tl = gsap
    .timeline({ defaults: { ease: 'power2.out' } })
    // The wheel hops off the hub, then bounces away down the road, shrinking
    // into the distance.
    .to(hub, { x: -40, y: -130, rotation: -60, svgOrigin: TYRE_CENTRE, duration: c.hop })
    .to(hub, {
      keyframes: [
        { x: 180, y: -470, scale: 0.45, rotation: -260, ease: 'power1.out' },
        { x: 300, y: -440, scale: 0.28, rotation: -420, ease: 'power2.in' }, // bounce
        { x: 400, y: -600, scale: 0.12, rotation: -560, ease: 'power1.out' },
        { ...AWAY, rotation: -660, autoAlpha: 0, ease: 'power1.in' },
      ],
      svgOrigin: TYRE_CENTRE,
      duration: c.fly,
    })
    // The car drops onto the bare corner and shakes.
    .to(arm, { rotation: 9, svgOrigin: ARM_ROOT, duration: 0.35, ease: 'bounce.out' }, c.hop * 0.5)
    .to(
      frame,
      { rotation: -c.lurch, y: 8, transformOrigin: '70% 100%', duration: 0.4, ease: 'bounce.out' },
      c.hop * 0.5,
    )
    .to(
      layer,
      { keyframes: { x: [-12, 10, -8, 6, -3, 0] }, duration: c.shake, ease: 'none' },
      c.hop * 0.5,
    )
    // Sparks flicker as the hub scrapes along.
    .to(sparks, { opacity: 1, duration: 0.06, repeat: 9, yoyo: true, ease: 'none' }, c.hop)
    .set(sparks, { opacity: 0 });
}

export function repair(reduced: boolean): void {
  const { layer, frame, hub, arm, sparks, gear } = parts();
  if (!hub) return;
  tl?.kill();
  if (gear) gear.textContent = '7';
  gsap.set(sparks, { opacity: 0 });
  gsap.set(layer, { x: 0 });
  if (reduced) {
    gsap.set([arm, frame], { clearProps: 'transform' });
    tl = gsap.timeline().to(hub, { autoAlpha: 1, duration: 0.3 });
    return;
  }
  tl = gsap
    .timeline({ defaults: { ease: 'power2.out' } })
    .fromTo(
      hub,
      { ...AWAY, rotation: 360, autoAlpha: 1, svgOrigin: TYRE_CENTRE },
      {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        svgOrigin: TYRE_CENTRE,
        duration: TIMINGS.crash.refit,
        ease: 'back.out(1.4)',
      },
    )
    .to(arm, { rotation: 0, svgOrigin: ARM_ROOT, duration: 0.3 }, '-=0.15')
    .to(frame, { rotation: 0, y: 0, duration: 0.35, ease: 'back.out(2)' }, '<');
}
