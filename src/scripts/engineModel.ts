/**
 * Engine model: renders a cross-plane V8 as real combustion pulses, sample by
 * sample, into two channels (one per cylinder bank). Pure maths, with no Web
 * Audio, so it can be measured in tests. soundSynth.ts plays the result
 * through exhaust filters.
 *
 * Why it sounds like a V8 rather than a tone:
 *   - Each firing is a short pressure pulse, not an oscillator.
 *   - Firing order 1-8-4-3-6-5-7-2 with cylinders 1-4 on the left bank: each
 *     bank's exhaust gets pulses at uneven intervals (180°, 90°, 360°, 90° of
 *     crank). Those uneven gaps are the cross-plane burble.
 *   - Every firing varies a little in strength (more when cold), the odd one
 *     misfires, and each cylinder has its own slight character (cam lope).
 *   - While cranking there's no combustion, just soft compression puffs and
 *     the starter motor labouring on each compression stroke.
 */

/** Crank angle (degrees) of each firing over one 720° cycle, and its bank. */
const FIRING = [1, 8, 4, 3, 6, 5, 7, 2].map((cylinder, i) => ({
  angle: i * 90,
  bank: cylinder <= 4 ? 0 : 1,
  cylinder,
}));

export interface EngineScript {
  /** Engine speed at time t (seconds). */
  rpm: (t: number) => number;
  /** Throttle / load, 0..1: stronger, sharper pulses with more rasp. */
  load: (t: number) => number;
  /** False while the starter is still cranking (compression only). */
  firing: (t: number) => boolean;
  /** Chance that a firing misfires (a weak, ragged pulse). */
  misfire?: (t: number) => number;
  /** Starter motor level at t (0 = disengaged). */
  starter?: (t: number) => number;
  /** Render at least this long, then stop on a whole engine cycle. */
  seconds: number;
  /** Wrap the last pulses' tails round to the start, for a seamless loop. */
  loop?: boolean;
  seed: number;
}

/** Deterministic pseudo-random numbers, so the engine sounds the same every visit. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Returns [left bank, right bank], ending on a whole engine cycle. */
export function renderEngine(
  sampleRate: number,
  script: EngineScript,
): [Float32Array, Float32Array] {
  const rand = seeded(script.seed);
  const pulseLen = Math.round(0.03 * sampleRate);
  const max = Math.ceil((script.seconds + 0.4) * sampleRate);
  const banks = [new Float32Array(max + pulseLen), new Float32Array(max + pulseLen)] as const;
  // The right bank's pipes are a touch longer: its pulses arrive slightly later.
  const bankDelay = [0, Math.round(0.0011 * sampleRate)];
  // Each cylinder burns a little differently.
  const character = FIRING.map(() => 0.85 + rand() * 0.3);

  const pulse = (
    bank: number,
    at: number,
    amp: number,
    attack: number,
    decay: number,
    grit: number,
  ) => {
    const out = banks[bank]!;
    const start = at + bankDelay[bank]!;
    const a = attack * sampleRate;
    const d = decay * sampleRate;
    // A sharp pressure peak, then the rarefaction as the wave reflects back,
    // plus a burst of rasp. Exponentials are stepped by multiplication (fast).
    const stepPeak = Math.exp(-1 / a);
    const stepBack = Math.exp(-1 / (a * 2));
    const stepTail = Math.exp(-1 / d);
    let ePeak = Math.E;
    let eBack = Math.E;
    let tail = 1;
    for (let j = 0; j < pulseLen; j++) {
      const peak = (j / a) * ePeak;
      let back = 0;
      if (j > a * 2) {
        back = ((j - a * 2) / (a * 2)) * eBack;
        eBack *= stepBack;
      }
      out[start + j]! += amp * (peak - 0.45 * back + grit * (rand() * 2 - 1) * tail);
      ePeak *= stepPeak;
      tail *= stepTail;
    }
  };

  let angle = 0; // total crank angle, degrees
  let k = 0; // index of the next firing event
  let starterPhase = 0;
  let end = max;

  for (let i = 0; i < max; i++) {
    const t = i / sampleRate;
    const rpm = script.rpm(t);

    while (angle >= k * 90) {
      // Finish on a whole cycle, so a loop (or the next buffer) carries on in step.
      if (t >= script.seconds && k % 8 === 0) {
        end = i;
        break;
      }
      const { bank, cylinder } = FIRING[k % 8]!;
      if (!script.firing(t)) {
        pulse(bank, i, 0.1, 0.005, 0.012, 0.15); // compression puff
      } else {
        const load = script.load(t);
        const misfired = rand() < (script.misfire?.(t) ?? 0);
        const amp =
          (0.32 + 0.68 * load) *
          (0.78 + rand() * 0.44) *
          character[cylinder - 1]! *
          (misfired ? 0.18 : 1);
        pulse(
          bank,
          i,
          amp,
          lerp(0.0019, 0.0008, load), // harder throttle, sharper bang
          lerp(0.011, 0.006, Math.min(rpm / 6000, 1)),
          misfired ? 1.2 : lerp(0.22, 0.6, load), // rasp
        );
      }
      k++;
    }
    if (end !== max) break;

    // Starter motor: a geared whirr whose pitch follows the cranking speed.
    const starter = script.starter?.(t) ?? 0;
    if (starter > 0) {
      starterPhase += (2 * Math.PI * rpm * 0.9) / sampleRate;
      const whirr =
        0.5 * Math.sin(starterPhase) +
        0.3 * Math.sin(2 * starterPhase + 0.4) +
        0.2 * Math.sin(3.02 * starterPhase) +
        0.25 * (rand() * 2 - 1);
      banks[0][i]! += starter * 0.11 * whirr;
      banks[1][i]! += starter * 0.11 * whirr;
    }

    angle += (rpm * 6) / sampleRate; // rpm → degrees per sample
  }

  if (script.loop) {
    for (const bank of banks) {
      for (let j = 0; j < pulseLen + bankDelay[1]!; j++) bank[j]! += bank[end + j]!;
    }
  }
  return [banks[0].slice(0, end), banks[1].slice(0, end)];
}

// ── The scripts ───────────────────────────────────────────────

export const IDLE_RPM = 1350; // cold-start fast idle
const CRANK_RPM = 230;
const CATCH = 0.85; // seconds of cranking before it fires
const FLARE_RPM = 2350;

const easeOut = (k: number) => 1 - Math.pow(1 - Math.min(Math.max(k, 0), 1), 3);
const easeInOut = (k: number) => {
  const x = Math.min(Math.max(k, 0), 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/**
 * Cold start: the starter cranks (each compression stroke drags it down), it
 * stumbles and catches, flares to ~2,350 rpm, then settles into a lumpy fast
 * idle. Ends at idle, ready for the idle loop.
 */
export const coldStart: EngineScript = {
  seed: 1187,
  seconds: 3.6,
  firing: (t) => t >= CATCH - 0.12,
  misfire: (t) => (t < CATCH + 0.12 ? 0.55 : t < CATCH + 0.6 ? 0.08 : 0.04),
  starter: (t) => (t < CATCH ? 1 : Math.max(0, 1 - (t - CATCH) / 0.12)),
  rpm: (t) => {
    if (t < CATCH) return CRANK_RPM * (1 + 0.22 * Math.sin(2 * Math.PI * 15 * t));
    if (t < CATCH + 0.32) return lerp(300, FLARE_RPM, easeOut((t - CATCH) / 0.32));
    if (t < 1.7) return lerp(FLARE_RPM, 1700, easeInOut((t - CATCH - 0.32) / (1.7 - CATCH - 0.32)));
    const settle = lerp(1700, IDLE_RPM, easeOut((t - 1.7) / 1.9));
    return settle + 25 * Math.sin(2 * Math.PI * 1.6 * t);
  },
  load: (t) => {
    if (t < CATCH) return 0.25;
    if (t < CATCH + 0.32) return 1;
    return lerp(0.75, 0.4, easeOut((t - CATCH - 0.32) / 1.4));
  },
};

/** Fast idle with a slow lope, rendered as a seamless loop. */
export const idleLoop: EngineScript = {
  seed: 733,
  seconds: 2.2,
  loop: true,
  firing: () => true,
  misfire: () => 0.03,
  rpm: (t) => IDLE_RPM + 25 * Math.sin(2 * Math.PI * 1.6 * t),
  load: () => 0.4,
};

/**
 * Launch: clutch drop (revs flare, then bog as the tyres bite), wheelspin up
 * the rev range, a gear change with the ignition cut, then pulling away.
 */
export const LAUNCH_SHIFT = 0.95;
export const pullAway: EngineScript = {
  seed: 4049,
  seconds: 2.6,
  firing: () => true,
  misfire: (t) => (t >= LAUNCH_SHIFT && t < LAUNCH_SHIFT + 0.07 ? 0.7 : 0.01),
  rpm: (t) => {
    if (t < 0.14) return lerp(IDLE_RPM, 4400, easeOut(t / 0.14));
    if (t < 0.3) return lerp(4400, 3600, easeInOut((t - 0.14) / 0.16));
    if (t < LAUNCH_SHIFT) return lerp(3600, 6300, easeOut((t - 0.3) / (LAUNCH_SHIFT - 0.3)));
    if (t < LAUNCH_SHIFT + 0.07) return lerp(6300, 4400, (t - LAUNCH_SHIFT) / 0.07);
    return lerp(4400, 6000, easeOut((t - LAUNCH_SHIFT - 0.07) / 1.5));
  },
  load: (t) => (t >= LAUNCH_SHIFT && t < LAUNCH_SHIFT + 0.07 ? 0.15 : 1),
};
