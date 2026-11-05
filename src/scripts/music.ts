/**
 * Music: an original soundtrack for the lap, composed here and synthesised
 * live with the Web Audio API (no audio files, nothing to license).
 *
 * D minor at 120 bpm, in the big driving film-score style: a pulsing
 * sixteenth-note bass, a four-on-the-floor kit, a wide detuned-saw pad, a
 * plucked arpeggio and a brassy lead hook. The progression and hook are
 * written for this site.
 *
 *   build(t)  the countdown: a pad and riser swell under the start lights
 *   drop(t)   lights out: an impact, then the groove starts and loops
 *   drive(k)  0..1 scroll speed: the bass filter and hats open up with it
 *   stop(t)   fade everything out
 *
 * A small look-ahead scheduler queues notes ~0.15s ahead on the audio clock,
 * so timing stays tight however busy the page is.
 */

const BPM = 120;
const STEP = 60 / BPM / 4; // one sixteenth
const BAR = 16; // steps per bar

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Eight bars: Dm | Bb | F | C | Dm | Bb | Gm | A. Root (bass) and chord tones (pad). */
const BARS = [
  { root: 38, chord: [50, 53, 57] },
  { root: 34, chord: [46, 50, 53] },
  { root: 41, chord: [48, 53, 57] },
  { root: 36, chord: [48, 52, 55] },
  { root: 38, chord: [50, 53, 57] },
  { root: 34, chord: [46, 50, 53] },
  { root: 43, chord: [46, 50, 55] },
  { root: 45, chord: [45, 49, 52] },
];

/** The hook: [bar, step, midi note, length in steps]. */
const HOOK: [number, number, number, number][] = [
  [0, 0, 69, 4],
  [0, 4, 74, 4],
  [0, 8, 77, 8],
  [1, 0, 74, 8],
  [1, 8, 72, 4],
  [1, 12, 69, 4],
  [2, 0, 72, 4],
  [2, 4, 77, 4],
  [2, 8, 81, 8],
  [3, 0, 79, 8],
  [3, 8, 76, 4],
  [3, 12, 72, 4],
  [4, 0, 69, 4],
  [4, 4, 74, 4],
  [4, 8, 77, 8],
  [5, 0, 74, 8],
  [5, 8, 77, 4],
  [5, 12, 79, 4],
  [6, 0, 70, 8],
  [6, 8, 74, 8],
  [7, 0, 73, 8],
  [7, 8, 76, 8],
];

// Bass: octave jumps on the off-sixteenths give it the galloping pulse.
const BASS_OCTAVE = [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 12, 0, 12];
// Arp: up and back down through the chord, an octave above the pad.
const ARP = [0, 1, 2, 3, 2, 1, 0, 1];

export function createMusic(c: AudioContext, out: AudioNode, noise: () => AudioBufferSourceNode) {
  let bus: GainNode | null = null;
  let timer = 0;
  let next = 0; // audio time of the next step to schedule
  let step = 0; // steps since the drop
  let drive = 0;
  let building: { stop: (at: number) => void } | null = null;

  /** A fresh output chain: bus ▶ gentle glue compressor ▶ out. */
  function chain(at: number): GainNode {
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -18;
    glue.ratio.value = 3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.45, at + 0.05);
    g.connect(glue).connect(out);
    return g;
  }

  function env(at: number, peak: number, attack: number, hold: number, release: number) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.setValueAtTime(peak, at + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
    return g;
  }

  function osc(type: OscillatorType, freq: number, at: number, until: number, detune = 0) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.start(at);
    o.stop(until);
    return o;
  }

  // ── Instruments ──────────────────────────────────────────
  function kick(at: number, dest: AudioNode): void {
    const o = osc('sine', 150, at, at + 0.4);
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    o.connect(env(at, 0.9, 0.003, 0.02, 0.3)).connect(dest);
  }

  function clap(at: number, dest: AudioNode): void {
    const n = noise();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 0.8;
    n.connect(bp)
      .connect(env(at, 0.45, 0.002, 0.01, 0.17))
      .connect(dest);
    n.start(at);
    n.stop(at + 0.25);
  }

  function hat(at: number, level: number, dest: AudioNode): void {
    const n = noise();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    n.connect(hp)
      .connect(env(at, level, 0.001, 0.005, 0.045))
      .connect(dest);
    n.start(at);
    n.stop(at + 0.08);
  }

  function bass(at: number, midi: number, accent: boolean, dest: AudioNode): void {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    const base = 420 + drive * 1600;
    f.frequency.setValueAtTime(base * (accent ? 3 : 2), at);
    f.frequency.exponentialRampToValueAtTime(base, at + STEP * 0.9);
    const g = env(at, accent ? 0.42 : 0.3, 0.004, STEP * 0.4, STEP * 0.5);
    osc('sawtooth', hz(midi), at, at + STEP * 1.2).connect(f);
    osc('square', hz(midi - 12), at, at + STEP * 1.2).connect(f);
    f.connect(g).connect(dest);
  }

  function pad(at: number, chord: number[], length: number, level: number, dest: AudioNode) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    const g = env(at, level, 0.35, length - 0.6, 0.5);
    for (const midi of chord) {
      for (const d of [-9, 9]) osc('sawtooth', hz(midi), at, at + length + 0.2, d).connect(f);
    }
    f.connect(g).connect(dest);
  }

  function pluck(at: number, midi: number, dest: AudioNode): void {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(5000, at);
    f.frequency.exponentialRampToValueAtTime(600, at + 0.18);
    osc('square', hz(midi), at, at + 0.3).connect(f);
    f.connect(env(at, 0.09, 0.003, 0.01, 0.22)).connect(dest);
  }

  function lead(at: number, midi: number, length: number, dest: AudioNode): void {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(800, at);
    f.frequency.linearRampToValueAtTime(2600, at + 0.12); // a brassy swell on each note
    const g = env(at, 0.11, 0.06, Math.max(0.05, length - 0.2), 0.18);
    for (const d of [-7, 0, 7]) osc('sawtooth', hz(midi), at, at + length + 0.3, d).connect(f);
    f.connect(g).connect(dest);
  }

  // ── Sequencer ────────────────────────────────────────────
  function schedule(): void {
    if (!bus) return;
    while (next < c.currentTime + 0.15) {
      const loop = Math.floor(step / (BAR * BARS.length));
      const barIndex = Math.floor(step / BAR) % BARS.length;
      const s = step % BAR;
      const bar = BARS[barIndex]!;
      const at = next;

      if (s % 4 === 0) kick(at, bus);
      if (s === 4 || s === 12) clap(at, bus);
      hat(at, s % 4 === 2 ? 0.12 + drive * 0.08 : 0.035 + drive * 0.04, bus);
      bass(at, bar.root + BASS_OCTAVE[s]!, s % 4 === 0, bus);
      if (s === 0) pad(at, bar.chord, BAR * STEP, 0.05, bus);
      // The arp joins on the second time round; the hook on every other loop after that.
      if (loop >= 1 && s % 2 === 0) {
        const tones = [...bar.chord, bar.chord[0]! + 12];
        pluck(at, tones[ARP[(s / 2) % ARP.length]!]! + 12, bus);
      }
      if (loop >= 1 && loop % 2 === 1) {
        for (const [b, st, midi, len] of HOOK) {
          if (b === barIndex && st === s) lead(at, midi, len * STEP, bus);
        }
      }

      next += STEP;
      step++;
    }
  }

  function startGroove(at: number): void {
    window.clearInterval(timer);
    bus ??= chain(at);
    next = at;
    step = 0;
    timer = window.setInterval(schedule, 25);
    schedule();
  }

  return {
    get playing() {
      return bus !== null;
    },

    /** The countdown swell: pad and a rising noise sweep, until drop() or stop(). */
    build(at: number): void {
      if (bus || building) return;
      const dest = chain(at);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(300, at);
      f.frequency.exponentialRampToValueAtTime(3500, at + 4);
      const g = c.createGain();
      // Linear swells: an exponential ramp from silence stays inaudible for most of its run.
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.12, at + 3.5);
      const oscs = [38, ...BARS[0]!.chord].flatMap((midi) =>
        [-10, 10].map((d) => osc('sawtooth', hz(midi), at, at + 12, d)),
      );
      oscs.forEach((o) => o.connect(f));
      f.connect(g).connect(dest);

      const n = noise();
      const sweep = c.createBiquadFilter();
      sweep.type = 'bandpass';
      sweep.Q.value = 1.5;
      sweep.frequency.setValueAtTime(400, at);
      sweep.frequency.exponentialRampToValueAtTime(6000, at + 4);
      const ng = c.createGain();
      ng.gain.setValueAtTime(0, at);
      ng.gain.linearRampToValueAtTime(0.08, at + 3.8);
      n.connect(sweep).connect(ng).connect(dest);
      n.start(at);
      n.stop(at + 12);

      building = {
        stop: (t) => {
          dest.gain.cancelScheduledValues(t);
          dest.gain.setValueAtTime(Math.max(dest.gain.value, 0.0001), t);
          dest.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
          oscs.forEach((o) => o.stop(t + 0.1));
          n.stop(t + 0.1);
          window.setTimeout(() => dest.disconnect(), 500);
        },
      };
    },

    /** Lights out: an impact, then the groove. */
    drop(at: number): void {
      building?.stop(at);
      building = null;
      const dest = (bus ??= chain(at));
      // Sub boom and a wash of cymbal.
      const boom = osc('sine', 70, at, at + 1.4);
      boom.frequency.exponentialRampToValueAtTime(32, at + 1.2);
      boom.connect(env(at, 0.8, 0.005, 0.05, 1.2)).connect(dest);
      const n = noise();
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      n.connect(hp)
        .connect(env(at, 0.25, 0.005, 0.05, 1.6))
        .connect(dest);
      n.start(at);
      n.stop(at + 1.8);
      pad(at, BARS[0]!.chord, 2, 0.08, dest);
      startGroove(at);
    },

    drive(k: number): void {
      drive = Math.min(Math.max(k, 0), 1); // read by each bass note and hat as it's scheduled
    },

    stop(at: number, fade = 0.4): void {
      window.clearInterval(timer);
      building?.stop(at);
      building = null;
      if (!bus) return;
      const g = bus;
      bus = null;
      g.gain.cancelScheduledValues(at);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + fade);
      window.setTimeout(() => g.disconnect(), (fade + 0.3) * 1000);
    },
  };
}

export type Music = ReturnType<typeof createMusic>;
