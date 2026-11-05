/**
 * TRACK: an original, stylised circuit loosely inspired by a classic British
 * airfield circuit layout. It is not a tracing of any real venue.
 *
 * - `waypoints` are smoothed into one closed path (src/lib/geometry.ts).
 *   The first waypoint is the start/finish line; the car drives them in order.
 * - Give a waypoint a `name` so lap sections (src/data/lap.ts) can point at it.
 * - Corner labels are in `corners` below. Rename "Turn 1" etc. freely.
 */
import { smoothClosedPath, type Point } from '../lib/geometry';

export const TRACK_VIEWBOX = { width: 1000, height: 680 } as const;

interface Waypoint {
  at: Point;
  name?: string;
}

const waypoints: Waypoint[] = [
  { at: [640, 612], name: 'start' }, // start/finish line, heading west
  { at: [520, 612] },
  { at: [436, 606] },
  { at: [392, 588], name: 't1' }, // fast right
  { at: [366, 560] },
  { at: [334, 538], name: 't2' }, // left kink
  { at: [292, 530] },
  { at: [266, 514], name: 't3' }, // right
  { at: [256, 484] },
  { at: [252, 446] },
  { at: [242, 414] },
  { at: [218, 398], name: 't4' }, // tight left hairpin
  { at: [192, 408] },
  { at: [182, 436] },
  { at: [180, 474] },
  { at: [168, 504], name: 't5' }, // double right onto the long straight
  { at: [138, 514] },
  { at: [108, 498] },
  { at: [98, 464] },
  { at: [124, 300], name: 'straight-1' }, // first long straight
  { at: [150, 164] },
  { at: [170, 116], name: 't6' }, // right
  { at: [210, 94] },
  { at: [260, 90] },
  { at: [352, 92] },
  { at: [398, 104], name: 't7' }, // fast right
  { at: [428, 132] },
  { at: [452, 154], name: 'esses' }, // fast flowing esses
  { at: [484, 156] },
  { at: [508, 140], name: 't8' },
  { at: [536, 136] },
  { at: [562, 156], name: 't9' },
  { at: [594, 168] },
  { at: [628, 168] },
  { at: [740, 228], name: 'back-straight' }, // back straight
  { at: [852, 292] },
  { at: [888, 322], name: 't10' }, // right
  { at: [902, 360] },
  { at: [900, 400], name: 'final' }, // final complex
  { at: [878, 436], name: 't11' }, // left flick
  { at: [858, 462] },
  { at: [856, 500] },
  { at: [846, 542], name: 't12' }, // right onto the pit straight
  { at: [818, 580] },
  { at: [770, 606] },
  { at: [720, 612] },
];

const smooth = smoothClosedPath(waypoints.map((w) => w.at));

/** The circuit's SVG path data. Used by the main track, the mini-map and the car. */
export const TRACK_PATH = smooth.d;

/** Start/finish line position and heading (degrees), for no-JS car placement. */
export const START = {
  x: waypoints[0]!.at[0],
  y: waypoints[0]!.at[1],
  angle: smooth.startAngle,
};

/** Lap progress (0 to 1) of a named waypoint. 'finish' is a full lap. Throws at build time on a typo. */
export function progressOf(name: string): number {
  if (name === 'finish') return 1;
  const index = waypoints.findIndex((w) => w.name === name);
  if (index === -1) throw new Error(`Unknown track waypoint "${name}"`);
  return smooth.progress[index]!;
}

/** Position of a named waypoint. */
export function pointOf(name: string): Point {
  const wp = waypoints.find((w) => w.name === name);
  if (!wp) throw new Error(`Unknown track waypoint "${name}"`);
  return wp.at;
}

/**
 * Corner labels drawn on the track. `offset` nudges the label away from the
 * tarmac in viewBox units. Rename freely; the numbers are just placeholders.
 */
export const corners: { waypoint: string; label: string; offset: Point }[] = [
  { waypoint: 't1', label: 'Turn 1', offset: [26, 34] },
  { waypoint: 't2', label: 'Turn 2', offset: [8, 44] },
  { waypoint: 't3', label: 'Turn 3', offset: [54, 0] },
  { waypoint: 't4', label: 'Turn 4', offset: [0, -30] },
  { waypoint: 't5', label: 'Turn 5', offset: [-8, 44] },
  { waypoint: 't6', label: 'Turn 6', offset: [-44, -16] },
  { waypoint: 't7', label: 'Turn 7', offset: [14, -30] },
  { waypoint: 't8', label: 'Turn 8', offset: [0, -30] },
  { waypoint: 't9', label: 'Turn 9', offset: [-6, 40] },
  { waypoint: 't10', label: 'Turn 10', offset: [52, -18] },
  { waypoint: 't11', label: 'Turn 11', offset: [-62, 2] },
  { waypoint: 't12', label: 'Turn 12', offset: [60, 10] },
];
