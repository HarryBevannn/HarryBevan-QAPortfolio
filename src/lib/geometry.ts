/**
 * Small geometry helpers used at build time to turn the track's waypoints into
 * a smooth closed SVG path, and to work out how far round the lap each
 * waypoint is (0 = start line, 1 = back at the line).
 */
export type Point = readonly [x: number, y: number];

interface Cubic {
  p0: Point;
  c1: Point;
  c2: Point;
  p1: Point;
}

const round = (n: number) => Math.round(n * 10) / 10;

function at<T>(list: readonly T[], i: number): T {
  const n = list.length;
  return list[((i % n) + n) % n] as T;
}

/**
 * Closed centripetal Catmull-Rom spline through every point, as cubic Béziers.
 * Centripetal (alpha = 0.5) copes with uneven spacing: dense points make
 * tight corners, sparse points make straights, with no overshoot or loops.
 */
function toCubics(points: readonly Point[], alpha = 0.5): Cubic[] {
  const dist = (a: Point, b: Point) =>
    Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]) ** alpha, 1e-6);
  return points.map((p1, i) => {
    const p0 = at(points, i - 1);
    const p2 = at(points, i + 1);
    const p3 = at(points, i + 2);
    const d1 = dist(p0, p1);
    const d2 = dist(p1, p2);
    const d3 = dist(p2, p3);
    const c1 = (k: 0 | 1) =>
      (d1 * d1 * p2[k] - d2 * d2 * p0[k] + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) /
      (3 * d1 * (d1 + d2));
    const c2 = (k: 0 | 1) =>
      (d3 * d3 * p1[k] - d2 * d2 * p3[k] + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) /
      (3 * d3 * (d3 + d2));
    return { p0: p1, c1: [c1(0), c1(1)], c2: [c2(0), c2(1)], p1: p2 };
  });
}

function pointOnCubic({ p0, c1, c2, p1 }: Cubic, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1],
  ];
}

function cubicLength(cubic: Cubic, steps = 32): number {
  let length = 0;
  let prev = cubic.p0;
  for (let s = 1; s <= steps; s++) {
    const next = pointOnCubic(cubic, s / steps);
    length += Math.hypot(next[0] - prev[0], next[1] - prev[1]);
    prev = next;
  }
  return length;
}

export interface SmoothPath {
  /** SVG path data, starting at points[0]. */
  d: string;
  /** Lap progress (0 to 1) at each input point. */
  progress: number[];
  /** Heading in degrees at points[0], for placing the car without JS. */
  startAngle: number;
}

export function smoothClosedPath(points: readonly Point[]): SmoothPath {
  const cubics = toCubics(points);
  const first = at(cubics, 0);
  const d =
    `M${round(first.p0[0])} ${round(first.p0[1])}` +
    cubics
      .map(
        ({ c1, c2, p1 }) =>
          `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p1[0])} ${round(p1[1])}`,
      )
      .join('') +
    'Z';

  const lengths = cubics.map((c) => cubicLength(c));
  const total = lengths.reduce((sum, l) => sum + l, 0);
  let running = 0;
  const progress = lengths.map((l) => {
    const p = running / total;
    running += l;
    return p;
  });

  const startAngle =
    (Math.atan2(first.c1[1] - first.p0[1], first.c1[0] - first.p0[0]) * 180) / Math.PI;

  return { d, progress, startAngle };
}
