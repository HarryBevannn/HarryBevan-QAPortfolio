/**
 * Sound synth: every sound is generated with the Web Audio API, so there are
 * no audio files, nothing to license, and nothing extra in the CSP.
 * Lazy-loaded by sound.ts.
 *
 * The engine is a cold-starting cross-plane V8. Its combustion pulses are
 * rendered sample by sample in src/scripts/engineModel.ts (starter cranking,
 * stumble and catch, flare, lumpy fast idle, launch), then played through an
 * exhaust: a DC-blocking high-pass, a body resonance, a bark resonance, a
 * muffler low-pass and soft saturation. The buffers are rendered once, in
 * idle time after the guard click, and reused.
 *
 * Also here: switch clicks, countdown beeps, exhaust pops, wheelspin squeal,
 * and the soundtrack (src/scripts/music.ts): it swells under the start
 * lights, drops at launch and loops for the lap. It pauses while the tab is
 * hidden.
 */
import type { SoundCue } from './sound';
import {
  coldStart,
  idleLoop,
  LAUNCH_SHIFT,
  pullAway,
  renderEngine,
  type EngineScript,
} from './engineModel';
import { createMusic, type Music } from './music';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let engine: Engine | null = null;
let music: Music | null = null;

function audio(): { c: AudioContext; out: GainNode } {
  if (!ctx || !master) {
    ctx = new AudioContext();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(limiter).connect(ctx.destination);
    // Don't play to an empty room: pause while the tab is hidden.
    const c = ctx;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && c.state === 'running') void c.suspend();
      else if (!document.hidden && c.state === 'suspended' && music?.playing) void c.resume();
    });
  }
  return { c: ctx, out: master };
}

function soundtrack(): Music {
  const { c, out } = audio();
  return (music ??= createMusic(c, out, () => noise(c)));
}

/** Create or resume the AudioContext. Call from a user gesture where possible. */
export function unlock(): void {
  const { c } = audio();
  if (c.state === 'suspended') void c.resume();
}

function noise(c: AudioContext): AudioBufferSourceNode {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.loopStart = Math.random();
  return src;
}

function filter(
  c: AudioContext,
  type: BiquadFilterType,
  frequency: number,
  Q = 1,
  gain = 0,
): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  f.gain.value = gain;
  return f;
}

/** A short envelope: instant attack, exponential decay. */
function envelope(c: AudioContext, t: number, peak: number, decay: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  return g;
}

/** Mechanical click: a bright noise tick plus a low thunk. */
function click(t: number, { bright = 3200, thunk = 150, level = 0.6, decay = 0.09 } = {}): void {
  const { c, out } = audio();
  const tick = noise(c);
  tick
    .connect(filter(c, 'bandpass', bright, 1.2))
    .connect(envelope(c, t, level, 0.035))
    .connect(out);
  tick.start(t);
  tick.stop(t + 0.05);

  const body = c.createOscillator();
  body.frequency.setValueAtTime(thunk, t);
  body.frequency.exponentialRampToValueAtTime(thunk * 0.5, t + decay);
  body.connect(envelope(c, t, level * 0.8, decay)).connect(out);
  body.start(t);
  body.stop(t + decay + 0.02);
}

/** Countdown tone. */
function beep(t: number, freq: number, length: number, level = 0.2): void {
  const { c, out } = audio();
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.008);
  g.gain.setValueAtTime(level, t + length - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc
    .connect(filter(c, 'lowpass', 2600))
    .connect(g)
    .connect(out);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

/** Exhaust crackle/pop: unburnt fuel igniting on the overrun. */
function pop(t: number, level: number): void {
  const { c, out } = audio();
  const burst = noise(c);
  burst
    .connect(filter(c, 'bandpass', 900 + Math.random() * 1800, 0.9))
    .connect(envelope(c, t, level, 0.03 + Math.random() * 0.05))
    .connect(out);
  burst.start(t);
  burst.stop(t + 0.1);
  const thump = c.createOscillator();
  thump.frequency.setValueAtTime(90 + Math.random() * 40, t);
  thump.frequency.exponentialRampToValueAtTime(45, t + 0.06);
  thump.connect(envelope(c, t, level * 0.9, 0.07)).connect(out);
  thump.start(t);
  thump.stop(t + 0.09);
}

function crackles(from: number, to: number, count: number): void {
  for (let i = 0; i < count; i++) {
    pop(from + Math.random() * (to - from), 0.18 + Math.random() * 0.35);
  }
}

/** Tyre squeal for wheelspin: resonant noise plus a wavering tone. */
function squeal(t: number, length: number): void {
  const { c, out } = audio();
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
  g.gain.setValueAtTime(0.16, t + length * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  g.connect(out);

  const hiss = noise(c);
  hiss.connect(filter(c, 'bandpass', 2300, 7)).connect(g);
  hiss.start(t);
  hiss.stop(t + length + 0.05);

  const tone = c.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(1750, t);
  tone.frequency.linearRampToValueAtTime(1950, t + length);
  const wobble = c.createOscillator();
  wobble.frequency.value = 11;
  const depth = c.createGain();
  depth.gain.value = 70;
  wobble.connect(depth).connect(tone.frequency);
  const toneLevel = c.createGain();
  toneLevel.gain.value = 0.35;
  tone.connect(toneLevel).connect(g);
  [tone, wobble].forEach((n) => {
    n.start(t);
    n.stop(t + length + 0.05);
  });
}

/** "Break it": a hard thump, a metallic clang, then the hub scraping the road. */
function crash(t: number): void {
  const { c, out } = audio();
  pop(t, 0.9);
  click(t + 0.01, { bright: 900, thunk: 70, level: 0.8, decay: 0.35 });
  // Clang: two inharmonic partials ringing down.
  for (const [f, level] of [
    [523, 0.12],
    [1307, 0.07],
  ] as const) {
    const ring = c.createOscillator();
    ring.type = 'triangle';
    ring.frequency.value = f;
    ring.connect(envelope(c, t + 0.02, level, 0.6)).connect(out);
    ring.start(t + 0.02);
    ring.stop(t + 0.7);
  }
  // Scrape: bright noise that fades as the car grinds to a stop.
  const scrape = noise(c);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  scrape
    .connect(filter(c, 'bandpass', 3400, 2.5))
    .connect(g)
    .connect(out);
  scrape.start(t + 0.15);
  scrape.stop(t + 1.5);
}

/** "Fix it": a pit crew's wheel gun, three quick rattles. */
function wheelGun(t: number): void {
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 6; k++) {
      click(t + i * 0.22 + k * 0.025, { bright: 5200, thunk: 260, level: 0.25, decay: 0.03 });
    }
  }
}

// ── Engine ────────────────────────────────────────────────────

const buffers = new Map<EngineScript, AudioBuffer>();

/** Render (once) and cache the engine buffer for a script. */
function engineBuffer(c: AudioContext, script: EngineScript): AudioBuffer {
  let buffer = buffers.get(script);
  if (!buffer) {
    const [left, right] = renderEngine(c.sampleRate, script);
    buffer = c.createBuffer(2, left.length, c.sampleRate);
    // Mostly one bank per side, with some crossover (like an X-pipe).
    const l = buffer.getChannelData(0);
    const r = buffer.getChannelData(1);
    for (let i = 0; i < left.length; i++) {
      l[i] = left[i]! + 0.45 * right[i]!;
      r[i] = right[i]! + 0.45 * left[i]!;
    }
    buffers.set(script, buffer);
  }
  return buffer;
}

/** Render the engine ahead of time (in idle time), so START plays instantly. */
function prepareEngine(): void {
  const { c } = audio();
  const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 60));
  // Wait for the guard to finish swinging, then render one buffer per idle slot.
  window.setTimeout(() => {
    for (const script of [coldStart, idleLoop, pullAway]) idle(() => engineBuffer(c, script));
  }, 1100);
}

class Engine {
  private bus: GainNode;
  private muffler: BiquadFilterNode;
  private level: GainNode;
  private distance: BiquadFilterNode;
  private voices: { src: AudioBufferSourceNode; gain: GainNode }[] = [];

  constructor(
    private c: AudioContext,
    out: AudioNode,
  ) {
    this.bus = c.createGain();
    this.bus.gain.value = 1.1; // drive into the saturator: grit at idle, growl (not buzz) at launch
    const dcBlock = filter(c, 'highpass', 38, 0.7);
    const body = filter(c, 'peaking', 95, 0.9, 7); // deep exhaust body
    const bark = filter(c, 'peaking', 420, 1.2, 3); // the bark on each pulse
    this.muffler = filter(c, 'lowpass', 1100, 0.6);

    const shaper = c.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.5);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';

    this.level = c.createGain();
    this.level.gain.value = 0.9;
    this.distance = filter(c, 'lowpass', 16000, 0.5);

    this.bus
      .connect(dcBlock)
      .connect(body)
      .connect(bark)
      .connect(this.muffler)
      .connect(shaper)
      .connect(this.level)
      .connect(this.distance)
      .connect(out);
  }

  /** Play a rendered script from `at`, optionally fading in over `fade` seconds. */
  voice(script: EngineScript, at: number, { loop = false, fade = 0 } = {}): AudioBufferSourceNode {
    const src = this.c.createBufferSource();
    src.buffer = engineBuffer(this.c, script);
    src.loop = loop;
    const gain = this.c.createGain();
    gain.gain.setValueAtTime(fade ? 0.0001 : 1, at);
    if (fade) gain.gain.exponentialRampToValueAtTime(1, at + fade);
    src.connect(gain).connect(this.bus);
    src.start(at);
    this.voices.push({ src, gain });
    return src;
  }

  /** Fade out everything playing now (and anything already scheduled). */
  silence(at: number, fade = 0.04): void {
    for (const { src, gain } of this.voices.splice(0)) {
      gain.gain.cancelScheduledValues(at);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + fade);
      src.stop(at + fade + 0.02);
    }
  }

  /** The muffler opens with load: dull at idle, brighter on the throttle. */
  open(at: number, frequency: number, over: number): void {
    this.muffler.frequency.setTargetAtTime(frequency, at, over / 3);
  }

  /** Muffle and quieten as the car drives away from the camera. */
  driveAway(from: number, to: number): void {
    this.distance.frequency.setValueAtTime(16000, from);
    this.distance.frequency.exponentialRampToValueAtTime(700, to);
    this.level.gain.setValueAtTime(this.level.gain.value, from);
    this.level.gain.exponentialRampToValueAtTime(0.0001, to);
  }
}

/**
 * Cold start, from the ignition cue: the starter cranks while the needles
 * sweep, it stumbles, catches and flares, then a lumpy fast idle runs through
 * the start lights until launch.
 */
function startEngine(t: number): void {
  const { c, out } = audio();
  engine?.silence(t);
  const e = (engine = new Engine(c, out));
  const start = e.voice(coldStart, t);
  e.voice(idleLoop, t + start.buffer!.duration, { loop: true });
  e.open(t, 900, 0.1); // cranking: muffled
  e.open(t + 0.85, 2400, 0.12); // catch and flare: the exhaust opens up
  e.open(t + 1.4, 1300, 1.2); // settling to idle
  click(t, { bright: 2000, thunk: 70, level: 0.35, decay: 0.12 }); // starter solenoid
}

/**
 * Launch, timed against the zoom: clutch drop, wheelspin with tyre squeal,
 * a gear change, then the car fades into the distance.
 */
function launch(t: number): void {
  const e = engine;
  if (!e) return;
  engine = null;
  e.silence(t, 0.05);
  e.voice(pullAway, t, { fade: 0.04 });
  e.open(t, 3400, 0.15);
  e.driveAway(t + 0.6, t + 2.5);
  squeal(t + 0.1, 1.05);
  pop(t + LAUNCH_SHIFT, 0.4); // gear-change crack...
  crackles(t + LAUNCH_SHIFT + 0.03, t + LAUNCH_SHIFT + 0.3, 3); // ...and a little spit
}

export function play(cue: SoundCue): void {
  const { c } = audio();
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime + 0.01;

  switch (cue) {
    case 'guard':
      click(t, { bright: 4200, thunk: 210, level: 0.5 });
      click(t + 0.07, { bright: 2600, thunk: 120, level: 0.35, decay: 0.12 });
      prepareEngine();
      break;
    case 'press':
      click(t, { bright: 1800, thunk: 90, level: 0.7, decay: 0.16 });
      break;
    case 'ignition':
      startEngine(t);
      break;
    case 'light':
      beep(t, 880, 0.16);
      soundtrack().build(t); // first light only: it swells until the drop
      break;
    case 'go':
      beep(t, 1320, 0.55, 0.24);
      break;
    case 'launch':
      launch(t);
      soundtrack().drop(t);
      break;
    case 'music':
      if (!soundtrack().playing) soundtrack().drop(t);
      break;
    case 'crash':
      crash(t);
      break;
    case 'repair':
      wheelGun(t);
      break;
  }
}

/** Scroll speed, 0..1: the soundtrack opens up as the visitor drives faster. */
export function drive(k: number): void {
  music?.drive(k);
}

export function stopAll(): void {
  if (!ctx) return;
  engine?.silence(ctx.currentTime, 0.15);
  engine = null;
  music?.stop(ctx.currentTime);
}
