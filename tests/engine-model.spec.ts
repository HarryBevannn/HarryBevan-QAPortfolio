import { expect, test } from '@playwright/test';
import {
  coldStart,
  idleLoop,
  IDLE_RPM,
  pullAway,
  renderEngine,
  type EngineScript,
} from '../src/scripts/engineModel';

// Pure maths, no browser: render each script once and check its shape.
const RATE = 48_000;
const render = (s: EngineScript) => renderEngine(RATE, s);

/** RMS over a window, after a crude DC block (like the exhaust's high-pass). */
function rms(x: Float32Array, from: number, to: number): number {
  let mean = 0;
  for (let i = from; i < to; i++) mean += x[i]!;
  mean /= to - from;
  let sum = 0;
  for (let i = from; i < to; i++) sum += (x[i]! - mean) ** 2;
  return Math.sqrt(sum / (to - from));
}

/** Dominant periodicity (Hz) by autocorrelation, searched between lo and hi Hz. */
function pitch(x: Float32Array, from: number, to: number, lo: number, hi: number): number {
  const w = x.slice(from, to);
  const mean = w.reduce((a, v) => a + v, 0) / w.length;
  for (let i = 0; i < w.length; i++) w[i]! -= mean;
  let best = -Infinity;
  let bestLag = 0;
  for (let lag = Math.floor(RATE / hi); lag <= Math.ceil(RATE / lo); lag++) {
    let sum = 0;
    for (let i = 0; i < w.length - lag; i++) sum += w[i]! * w[i + lag]!;
    sum /= w.length - lag;
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  return RATE / bestLag;
}

test.describe('Engine model', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure maths: runs once, on desktop.');

  test('renders finite, deterministic audio for every script', () => {
    for (const script of [coldStart, idleLoop, pullAway]) {
      const [left, right] = render(script);
      expect(left.length).toBe(right.length);
      expect(left.length / RATE).toBeGreaterThanOrEqual(script.seconds);
      expect(left.every(Number.isFinite) && right.every(Number.isFinite)).toBe(true);
      expect(render(script)[0]).toEqual(left); // same every visit
    }
  });

  test('a cold start cranks slowly, flares, then settles to a fast idle', () => {
    const [left] = render(coldStart);
    const at = (s: number) => Math.round(s * RATE);
    // Cranking: quiet compression puffs. Running: much louder combustion.
    const cranking = rms(left, at(0.1), at(0.7));
    const flare = rms(left, at(0.95), at(1.2));
    const idle = rms(left, at(3), at(3.5));
    expect(flare).toBeGreaterThan(cranking * 3);
    expect(flare).toBeGreaterThan(idle);
    // Idle fires 4 times per crank turn (8 cylinders over two turns). Each bank
    // alone fires unevenly (the cross-plane burble); together they're even.
    const [l, r] = render(coldStart);
    const both = l.map((v, i) => v + r[i]!);
    const firing = (IDLE_RPM / 60) * 4;
    const heard = pitch(both, at(3), at(3.5), firing * 0.6, firing * 1.5);
    expect(Math.abs(heard - firing) / firing).toBeLessThan(0.08);
  });

  test('the launch is louder than idle and the idle loop is seamless', () => {
    const [launch] = render(pullAway);
    const [idle] = render(idleLoop);
    expect(rms(launch, 0, RATE)).toBeGreaterThan(rms(idle, 0, RATE) * 1.5);
    // Seamless loop: the join is no louder than the rest of the loop.
    const join = Math.abs(idle[idle.length - 1]! - idle[0]!);
    expect(join).toBeLessThan(Math.max(...idle.slice(0, RATE / 10).map(Math.abs)));
  });
});
