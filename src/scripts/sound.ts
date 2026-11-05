/**
 * Sound: ON by default, one tap to mute, and the visitor's choice is
 * remembered (localStorage, wrapped in try/catch). Browsers only allow audio
 * after a user gesture, so nothing plays until the visitor lifts the guard.
 *
 * All audio is synthesised live with the Web Audio API (src/scripts/soundSynth.ts),
 * so no audio files ship, including the original soundtrack (src/scripts/music.ts). The synth is fetched in idle time, not on the
 * critical path.
 */
export type SoundCue =
  | 'guard' // safety guard snaps open
  | 'press' // START button clunk
  | 'ignition' // starter, catch, rev to the limiter, crackles, lumpy idle
  | 'light' // countdown beep as each red light comes on
  | 'go' // lights turn green
  | 'launch' // clutch drop, wheelspin, gear change, drive away; the soundtrack drops
  | 'music' // start the soundtrack now (Skip intro, or sound switched back on)
  | 'crash' // "Break it": a wheel comes off, with a bang and a scrape
  | 'repair'; // "Fix it": the pit crew's wheel gun

type Synth = typeof import('./soundSynth');

const PREF_KEY = 'hb:sound';

function readPref(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writePref(on: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked: the choice just lasts for this page view */
  }
}

let enabled = readPref();
let synth: Promise<Synth> | null = null;
const listeners = new Set<(on: boolean) => void>();

const loadSynth = () => (synth ??= import('./soundSynth'));

export const sound = {
  get enabled(): boolean {
    return enabled;
  },

  /** Call from a click handler: browsers only allow audio after a user gesture. */
  setEnabled(on: boolean): void {
    enabled = on;
    writePref(on);
    if (on) void loadSynth().then((s) => s.unlock());
    else sound.stopAll();
    listeners.forEach((fn) => fn(on));
  },

  onChange(fn: (on: boolean) => void): void {
    listeners.add(fn);
  },

  /** Fetch the synth ahead of time (no AudioContext is created). */
  preload(): void {
    if (enabled) void loadSynth();
  },

  play(cue: SoundCue): void {
    if (!enabled) return;
    void loadSynth().then((s) => s.play(cue));
  },

  /** Scroll speed, 0..1, for the soundtrack. Free when the synth isn't loaded. */
  drive(k: number): void {
    if (enabled) void synth?.then((s) => s.drive(k));
  },

  /** Silence everything (Skip intro, Replay start, sound switched off). */
  stopAll(): void {
    void synth?.then((s) => s.stopAll());
  },
};
