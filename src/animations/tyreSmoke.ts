/**
 * Tyre smoke: the car lights up its rear tyres as it pulls off the line.
 *
 *   - Big clouds billow up from the bottom of the screen as the cockpit falls
 *     away, covering the cut to the live view.
 *   - Given a top-down car, a stream of puffs also pours out behind its rear
 *     wheels, read from the car's live on-screen position, and the car
 *     fishtails a little as the tyres fight for grip. (The first-person
 *     launch has no car on screen, so it gets the clouds only.)
 *
 * Every puff is a plain div animated with transform and opacity only, so it
 * stays smooth on phones. Not used under prefers-reduced-motion.
 */
import { gsap } from 'gsap';
import { TIMINGS } from './timings';

export interface SmokeTargets {
  layer: HTMLElement;
  /** A top-down car <g>; data-heading holds its direction of travel in degrees. */
  car?: SVGGraphicsElement;
  /** The car's inner body group (fishtails without fighting the lap transform). */
  body?: SVGGraphicsElement | null;
}

const rand = gsap.utils.random;

/** Screen positions of the two rear tyres, from the car's box and heading. */
function rearTyres(car: SVGGraphicsElement): { x: number; y: number; back: number }[] {
  const r = car.getBoundingClientRect();
  const heading = (Number(car.dataset.heading ?? 180) * Math.PI) / 180;
  const back = heading + Math.PI; // smoke streams out behind the car
  const len = Math.max(r.width, r.height) / 2;
  const wid = Math.min(r.width, r.height) / 2;
  const cx = r.left + r.width / 2 + Math.cos(back) * len * 0.55;
  const cy = r.top + r.height / 2 + Math.sin(back) * len * 0.55;
  const px = -Math.sin(back) * wid * 0.75;
  const py = Math.cos(back) * wid * 0.75;
  return [
    { x: cx + px, y: cy + py, back },
    { x: cx - px, y: cy - py, back },
  ];
}

function puff(layer: HTMLElement, big = false): HTMLElement {
  const el = document.createElement('div');
  el.className = big ? 'smoke__puff smoke__puff--big' : 'smoke__puff';
  layer.append(el);
  return el;
}

export function tyreSmoke({ layer, car, body }: SmokeTargets): gsap.core.Timeline {
  const s = TIMINGS.smoke;
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const tl = gsap.timeline({ onComplete: () => layer.replaceChildren() });

  // 1. Cover clouds rolling up from the bottom corners.
  for (let i = 0; i < s.coverPuffs; i++) {
    const el = puff(layer, true);
    const fromLeft = i % 2 === 0;
    const x0 = fromLeft
      ? rand(-0.15, 0.25) * window.innerWidth
      : rand(0.75, 1.15) * window.innerWidth;
    tl.fromTo(
      el,
      {
        x: x0,
        y: window.innerHeight * rand(1.05, 1.3),
        xPercent: -50,
        yPercent: -50,
        scale: 0.5,
        opacity: 0,
        rotation: rand(0, 360),
      },
      {
        keyframes: {
          opacity: [0, s.coverOpacity, s.coverOpacity * 0.8, 0],
          easeEach: 'sine.inOut',
        },
        x: x0 + (fromLeft ? 1 : -1) * rand(0.1, 0.3) * window.innerWidth,
        y: window.innerHeight * rand(0.25, 0.6),
        scale: rand(1.1, 1.6),
        rotation: `+=${rand(40, 120)}`,
        duration: rand(s.coverDuration * 0.8, s.coverDuration),
        ease: 'power2.out',
      },
      i * 0.06,
    );
  }

  // 2. The stream from the rear tyres, emitted as the camera pulls up.
  const tyres = car;
  for (let i = 0; tyres && i < s.trailPuffs; i++) {
    const el = puff(layer);
    const tyre = i % 2;
    // Read the car's position once, at the moment this puff is emitted
    // (immediateRender: false defers that until the puff's start time).
    let cached: { x: number; y: number; back: number } | undefined;
    const at = () => (cached ??= rearTyres(tyres)[tyre]!);
    const spread = rand(-0.6, 0.6);
    const reach = vmin * rand(0.2, 0.5);
    tl.fromTo(
      el,
      {
        x: () => at().x,
        y: () => at().y,
        xPercent: -50,
        yPercent: -50,
        scale: () => rand(0.15, 0.3),
        opacity: 0,
        rotation: () => rand(0, 360),
      },
      {
        keyframes: { opacity: [0, s.trailOpacity, s.trailOpacity * 0.6, 0], easeEach: 'sine.out' },
        x: () => at().x + Math.cos(at().back + spread) * reach,
        y: () => at().y + Math.sin(at().back + spread) * reach,
        scale: () => rand(1.2, 2.4),
        rotation: `+=${rand(60, 180)}`,
        duration: rand(s.trailDuration * 0.75, s.trailDuration),
        ease: 'power2.out',
        immediateRender: false,
      },
      0.05 + (i / s.trailPuffs) * s.emitFor,
    );
  }

  // 3. Fishtail as the rear tyres fight for grip.
  if (body) {
    tl.to(
      body,
      {
        keyframes: { rotation: [0, 6, -5, 3, -1.5, 0] },
        transformOrigin: '50% 50%',
        duration: s.fishtail,
        ease: 'none',
      },
      0,
    );
  }

  return tl;
}
