/**
 * Road: the first-person view through the windscreen, drawn on a 2D canvas.
 *
 * No WebGL. The circuit's own centreline (the same SVG path the top-down map
 * uses) is sampled into evenly spaced points, and each frame those points are
 * projected from a camera sitting in the car:
 *
 *   world (x, y) on the track plan ──▶ camera space (right, forward, up)
 *                                  ──▶ screen (x, y) with a simple pinhole
 *
 * So every bend you drive is the real shape of the track on the mini-map.
 * It's a bright race day: blue sky, sun and clouds, mown verges, gravel traps
 * in the corners, tyre walls, and grandstands full of crowd.
 *
 * Ground is drawn in two passes (verge, then tarmac/kerbs), which needs no
 * depth sorting because a flat ground plane never overlaps itself on screen.
 * Upright things (tyre walls, grandstands, gantries, corner boards) are
 * sorted far to near so the nearer ones hide what's behind them.
 *
 * The camera can also lift and pitch down (`lift` 0..1) for the pull-up to
 * the top-down view at the end of the lap.
 *
 * Nothing animates on its own: the lap calls draw() whenever the car moves,
 * so a still page costs nothing.
 */

export interface RoadBoard {
  /** Lap progress (0..1) the board stands at (a stand's middle). */
  p: number;
  kind: 'gantry' | 'corner' | 'stand';
  /** Big label, e.g. "02" or "TURN 1" (unused for stands). */
  num: string;
  title: string;
  /** Stands only: length along the track, in plan units. */
  len?: number;
  /** Stands only: 1 = right of the car, -1 = left. Default: outside of the bend. */
  side?: 1 | -1;
}

export interface Camera {
  /** Lap progress 0..1 (values outside wrap round the lap). */
  p: number;
  /** Extra yaw in degrees (the car sliding through a corner). */
  yaw?: number;
  /** Roll in degrees (leaning into a corner). */
  roll?: number;
  /** 0 = in the cockpit, 1 = high above the track looking down. */
  lift?: number;
}

type Vec = { x: number; y: number };

// Track plan units: the tarmac is 22 wide on the SVG map, so keep that scale.
const ROAD = {
  samples: 2400,
  half: 10.4, // tarmac half-width
  edge: 11, // white edge line out to here
  kerb: 13.6, // kerbs out to here (in corners only)
  verge: 40, // striped run-off out to here; tyre wall on its edge
  wall: 1.1, // tyre wall height
  wallBlock: 5, // tyre wall colour block length
  eye: 2.8, // eye height above the tarmac
  ahead: 520, // how far ahead to draw (plan units)
  near: 0.4,
  stripe: 14, // run-off stripe length
  kerbBlock: 3.2, // kerb block length
  dash: 7, // racing-line dash length
  liftEye: 260, // eye height at full lift
  liftPitch: 72, // degrees looking down at full lift
  // Grandstands: front wall, raked seating, roof (offsets from the centreline).
  standFront: 45,
  standBack: 68,
  standLow: 2.6,
  standHigh: 13,
  standRoof: 17,
  standPiece: 6, // drawn in pieces this long, so it bends with the track
  crowdScale: 8, // crowd texture pixels per plan unit
};

// Canvas fills can't read CSS variables, so mirror theme.css here.
const C = {
  skyTop: '#3f86d4',
  skyLow: '#cfe5f6',
  sun: '255 246 214',
  cloud: '#ffffff',
  hillFar: '#9fb9cf',
  hillNear: '#557f49',
  ground: '#4f8a3c',
  vergeA: '#5c9a45',
  vergeB: '#68a84f',
  gravelA: '#d8c8a0',
  gravelB: '#cfbd93',
  tarmacA: '#53575e',
  tarmacB: '#565a61',
  edge: '#f5f6f7',
  kerbRed: '#e10600',
  kerbWhite: '#f5f6f7',
  line: '#7ee0ff',
  board: '#101216',
  boardEdge: '#30343c',
  post: '#3b3f45',
  text: '#f5f6f7',
  muted: '#b3b8c0',
  red: '#e10600',
  fog: '214 229 242',
  tyreRed: '#d1342b',
  tyreWhite: '#eef0f2',
  standWall: '#c9ced6',
  standBack: '#5d646e',
  standRoof: '#e9ecef',
  standUnder: '#7d848e',
  standPost: '#9aa0a8',
  seats: '#3b4a63',
};

/** Seat rows full of people, drawn once and used as a repeating pattern. */
function crowdTexture(): HTMLCanvasElement {
  const tex = document.createElement('canvas');
  tex.width = 240;
  tex.height = 120;
  const g = tex.getContext('2d');
  if (!g) return tex;
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const shirts = [
    '#e10600',
    '#f5f6f7',
    '#1f4fa8',
    '#ffb000',
    '#2d8f4e',
    '#14161a',
    '#7ee0ff',
    '#ff7a1a',
    '#c2185b',
  ];
  const skins = ['#f1c9a5', '#d9a074', '#a8693f', '#6b4226', '#f6d7bf'];
  g.fillStyle = C.seats;
  g.fillRect(0, 0, tex.width, tex.height);
  const rows = 16;
  const rowH = tex.height / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    g.fillStyle = 'rgb(0 0 0 / 0.25)'; // step edge
    g.fillRect(0, y + rowH - 1, tex.width, 1);
    for (let x = 1; x < tex.width; x += 4 + rand() * 4) {
      if (rand() < 0.12) continue; // the odd empty seat
      g.fillStyle = shirts[Math.floor(rand() * shirts.length)]!;
      g.fillRect(x, y + rowH * 0.42, 4.2, rowH * 0.5);
      g.fillStyle = skins[Math.floor(rand() * skins.length)]!;
      g.beginPath();
      g.arc(x + 2.1, y + rowH * 0.3, 1.7, 0, Math.PI * 2);
      g.fill();
      if (rand() < 0.05) {
        g.fillStyle = rand() < 0.5 ? '#e10600' : '#f5f6f7'; // a waved flag
        g.fillRect(x + 3, y - 1, 4, 3);
      }
    }
  }
  return tex;
}

export function createRoad(
  canvas: HTMLCanvasElement,
  samplePath: (t: number) => Vec,
  boards: RoadBoard[],
) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  // ── Sample the centreline once ───────────────────────────
  const N = ROAD.samples;
  const pts: Vec[] = Array.from({ length: N }, (_, i) => samplePath(i / N));
  const at = (i: number) => pts[((i % N) + N) % N]!;

  let length = 0;
  for (let i = 0; i < N; i++) {
    length += Math.hypot(at(i + 1).x - at(i).x, at(i + 1).y - at(i).y);
  }
  const step = length / N;

  // Unit tangent and right-hand normal at each sample (y is down on the plan).
  const tan: Vec[] = pts.map((_, i) => {
    const a = at(i - 2);
    const b = at(i + 2);
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  });
  const nrm: Vec[] = tan.map((t) => ({ x: -t.y, y: t.x }));
  const heading = tan.map((t) => Math.atan2(t.y, t.x));

  // Signed curvature, smoothed: + bends right. Kerbs go where it's high.
  const turn = (i: number) => {
    const a = heading[((i % N) + N) % N]!;
    const b = heading[(((i + 1) % N) + N) % N]!;
    return Math.atan2(Math.sin(b - a), Math.cos(b - a));
  };
  const span = Math.round(18 / step);
  const curve = pts.map((_, i) => {
    let sum = 0;
    for (let k = -span; k <= span; k++) sum += turn(i + k);
    return sum / (2 * span + 1) / step;
  });
  const kerbed = curve.map((c) => Math.abs(c) > 0.006);

  // Boards sit at sample indices. Corner boards stand a little before the
  // bend, on its outside, so they're read on the way in.
  const wrap = (i: number) => ((i % N) + N) % N;
  const placed = boards
    .filter((b) => b.kind !== 'stand')
    .map((b) => {
      const apex = Math.round(b.p * N);
      const i = wrap(b.kind === 'corner' ? apex - Math.round(34 / step) : apex);
      return { ...b, i, side: (curve[wrap(apex)]! >= 0 ? -1 : 1) as 1 | -1 };
    });

  // Grandstands, cut into short pieces along the track.
  const piece = Math.max(1, Math.round(ROAD.standPiece / step));
  const stands = boards
    .filter((b) => b.kind === 'stand')
    .flatMap((b) => {
      const mid = Math.round(b.p * N);
      const half = Math.round((b.len ?? 120) / 2 / step / piece) * piece;
      const side = b.side ?? ((curve[wrap(mid)]! >= 0 ? -1 : 1) as 1 | -1);
      const pieces: { i: number; side: 1 | -1 }[] = [];
      for (let k = -half; k < half; k += piece) pieces.push({ i: wrap(mid + k), side });
      return pieces;
    });
  const crowd = ctx.createPattern(crowdTexture(), 'repeat');

  let w = 0;
  let h = 0;
  let dpr = 1;
  let cx = 0.5;

  /** Match the canvas to its box. cxFraction: where the vanishing point sits across. */
  function resize(cxFraction: number): void {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.max(1, Math.round(box.width));
    h = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    cx = cxFraction;
  }

  /** Steering input: how much the road bends over the next stretch, + = right. */
  function bendAhead(p: number): number {
    const i0 = Math.floor((((p % 1) + 1) % 1) * N);
    const reach = Math.round(60 / step);
    let sum = 0;
    for (let k = 4; k < reach; k++) sum += turn(i0 + k);
    return sum;
  }

  function draw(cam: Camera): void {
    if (!ctx || w < 2) return;
    const lift = Math.min(Math.max(cam.lift ?? 0, 0), 1);
    const lk = lift * lift * (3 - 2 * lift); // smoothstep
    const pitch = ((ROAD.liftPitch * lk) / 180) * Math.PI;
    const eye = ROAD.eye + (ROAD.liftEye - ROAD.eye) * lk * lk;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    // Camera position and heading, between samples.
    const u = (((cam.p % 1) + 1) % 1) * N;
    const i0 = Math.floor(u);
    const f = u - i0;
    const a = at(i0);
    const b = at(i0 + 1);
    const camX = a.x + (b.x - a.x) * f;
    const camY = a.y + (b.y - a.y) * f;
    // Look slightly ahead so the view turns in smoothly.
    const look = at(i0 + Math.round(6 / step) + 1);
    let yaw = Math.atan2(look.y - camY, look.x - camX);
    yaw += ((cam.yaw ?? 0) * Math.PI) / 180;
    const fx = Math.cos(yaw);
    const fy = Math.sin(yaw);

    const F = Math.max(w, h * 1.15) * 0.5;
    const ox = w * cx;
    const oy = h * (0.42 + 0.12 * lk);

    /** Plan point + elevation ▶ screen. null when behind the camera. */
    const project = (x: number, y: number, up = 0): Vec | null => {
      const dx = x - camX;
      const dy = y - camY;
      const fwd = dx * fx + dy * fy;
      const right = -dx * fy + dy * fx;
      const v = up - eye;
      const z = fwd * cosP - v * sinP;
      if (z < ROAD.near) return null;
      const vy = v * cosP + fwd * sinP;
      return { x: ox + (right / z) * F, y: oy - (vy / z) * F };
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const roll = ((cam.roll ?? 0) * Math.PI) / 180;
    if (roll) {
      ctx.translate(ox, oy);
      ctx.rotate(roll);
      ctx.translate(-ox, -oy);
    }

    // ── Sky, distant hills and ground ────────────────────────
    const horizon = oy - Math.tan(pitch) * F;
    const pad = Math.max(w, h); // room for roll
    if (horizon > -pad) {
      const sky = ctx.createLinearGradient(0, horizon - h * 0.5, 0, horizon);
      sky.addColorStop(0, C.skyTop);
      sky.addColorStop(1, C.skyLow);
      ctx.fillStyle = sky;
      ctx.fillRect(-pad, -pad, w + pad * 2, horizon + pad);
      sunAndClouds(horizon, yaw, F);
      hills(horizon, yaw, F, pad, lk);
    }
    ctx.fillStyle = C.ground;
    ctx.fillRect(-pad, Math.max(horizon, -pad), w + pad * 2, h + pad * 2);

    // ── Which samples to draw ────────────────────────────────
    const aheadN = Math.round(ROAD.ahead / step);
    const from = lk > 0 ? i0 - Math.round(aheadN * 3 * lk) : i0;
    const to = lk > 0 ? i0 + aheadN + Math.round(N * lk) : i0 + aheadN;
    const count = Math.min(to - from, N);
    const offsets = [
      -ROAD.verge,
      -ROAD.kerb,
      -ROAD.edge,
      -ROAD.half,
      ROAD.half,
      ROAD.edge,
      ROAD.kerb,
      ROAD.verge,
    ];
    const rows: ((Vec | null)[] | null)[] = [];
    const dist: number[] = [];
    for (let k = 0; k <= count; k++) {
      const i = from + k;
      const p = at(i);
      const n = nrm[((i % N) + N) % N]!;
      rows.push(offsets.map((o) => project(p.x + n.x * o, p.y + n.y * o)));
      dist.push((((i % N) + N) % N) * step);
    }

    const buckets = new Map<string, Path2D>();
    const quad = (
      colour: string,
      r0: (Vec | null)[],
      r1: (Vec | null)[],
      l: number,
      rt: number,
    ) => {
      const A = r0[l];
      const B = r0[rt];
      const D = r1[l];
      const E = r1[rt];
      if (!A || !B || !D || !E) return;
      let path = buckets.get(colour);
      if (!path) buckets.set(colour, (path = new Path2D()));
      path.moveTo(A.x, A.y);
      path.lineTo(B.x, B.y);
      path.lineTo(E.x, E.y);
      path.lineTo(D.x, D.y);
      path.closePath();
    };
    const flush = (order: string[]) => {
      for (const colour of order) {
        const path = buckets.get(colour);
        if (!path) continue;
        ctx.fillStyle = colour;
        ctx.fill(path);
      }
      buckets.clear();
    };

    // Pass 1: striped run-off. Pass 2: kerbs, edge lines and tarmac.
    for (let k = 0; k < count; k++) {
      const r0 = rows[k]!;
      const r1 = rows[k + 1]!;
      const odd = Math.floor(dist[k]! / ROAD.stripe) % 2;
      const gravel = kerbed[wrap(from + k)];
      quad(gravel ? (odd ? C.gravelA : C.gravelB) : odd ? C.vergeA : C.vergeB, r0, r1, 0, 7);
    }
    flush([C.vergeA, C.vergeB, C.gravelA, C.gravelB]);

    for (let k = 0; k < count; k++) {
      const r0 = rows[k]!;
      const r1 = rows[k + 1]!;
      const s = dist[k]!;
      const i = (((from + k) % N) + N) % N;
      if (kerbed[i]) {
        const kc = Math.floor(s / ROAD.kerbBlock) % 2 ? C.kerbRed : C.kerbWhite;
        quad(kc, r0, r1, 1, 2);
        quad(kc, r0, r1, 5, 6);
      }
      quad(C.edge, r0, r1, 2, 3);
      quad(C.edge, r0, r1, 4, 5);
      quad(Math.floor(s / 9) % 2 ? C.tarmacA : C.tarmacB, r0, r1, 3, 4);
    }
    flush([C.kerbRed, C.kerbWhite, C.edge, C.tarmacA, C.tarmacB]);

    // Racing line (dashed) and the chequered start/finish line on top.
    ctx.globalAlpha = 0.4;
    const line = new Path2D();
    for (let k = 0; k < count; k++) {
      if (Math.floor(dist[k]! / ROAD.dash) % 2) continue;
      const i = from + k;
      const p0 = at(i);
      const p1 = at(i + 1);
      const n0 = nrm[((i % N) + N) % N]!;
      const A = project(p0.x - n0.x * 0.2, p0.y - n0.y * 0.2);
      const B = project(p0.x + n0.x * 0.2, p0.y + n0.y * 0.2);
      const D = project(p1.x - n0.x * 0.2, p1.y - n0.y * 0.2);
      const E = project(p1.x + n0.x * 0.2, p1.y + n0.y * 0.2);
      if (!A || !B || !D || !E) continue;
      line.moveTo(A.x, A.y);
      line.lineTo(B.x, B.y);
      line.lineTo(E.x, E.y);
      line.lineTo(D.x, D.y);
    }
    ctx.fillStyle = C.line;
    ctx.fill(line);
    ctx.globalAlpha = 1;
    chequers(project);

    // Haze where the road meets the sky.
    if (horizon > -pad && horizon < h) {
      const fog = ctx.createLinearGradient(0, horizon - 2, 0, horizon + h * 0.12);
      fog.addColorStop(0, `rgb(${C.fog} / 0.9)`);
      fog.addColorStop(1, `rgb(${C.fog} / 0)`);
      ctx.fillStyle = fog;
      ctx.fillRect(-pad, horizon - 2, w + pad * 2, h * 0.12 + 2);
    }

    // ── Upright things, far to near ─────────────────────────
    // Each gets its distance (in samples) from the camera, then they're drawn
    // farthest first so nearer walls, stands and boards cover what's behind.
    const uprights: { d: number; draw: () => void }[] = [];
    const camAt = u - from; // the camera, in samples from `from`
    const inView = (i: number) => {
      const rel = wrap(i - from);
      return rel <= count ? Math.abs(rel - camAt) : -1;
    };

    // Tyre walls along both edges of the run-off, in chunks.
    const chunk = 8;
    for (let k0 = 0; k0 < count; k0 += chunk) {
      uprights.push({
        d: Math.abs(k0 + chunk / 2 - camAt),
        draw: () => {
          for (let k = k0; k < Math.min(k0 + chunk, count); k++) {
            const i = from + k;
            const colour = Math.floor(dist[k]! / ROAD.wallBlock) % 2 ? C.tyreRed : C.tyreWhite;
            for (const o of [-ROAD.verge, ROAD.verge]) {
              wallQuad(colour, i, o, project);
            }
          }
          flush([C.tyreRed, C.tyreWhite]);
        },
      });
    }

    for (const st of stands) {
      const d = inView(st.i);
      if (d >= 0) uprights.push({ d, draw: () => drawStand(st.i, st.side, project) });
    }

    if (lk < 0.6) {
      for (const board of placed) {
        const d = inView(board.i);
        if (d < 0 || wrap(board.i - i0) > aheadN) continue;
        uprights.push({
          d,
          draw: () => {
            ctx.globalAlpha = 1 - lk / 0.6;
            drawBoard(board, project);
            ctx.globalAlpha = 1;
          },
        });
      }
    }

    uprights.sort((x, y) => y.d - x.d).forEach((item) => item.draw());

    /** A strip of tyre wall between sample i and i + 1, `o` from the centreline. */
    function wallQuad(colour: string, i: number, o: number, pr: typeof project): void {
      const p0 = at(i);
      const p1 = at(i + 1);
      const n0 = nrm[wrap(i)]!;
      const n1 = nrm[wrap(i + 1)]!;
      const A = pr(p0.x + n0.x * o, p0.y + n0.y * o, 0);
      const B = pr(p1.x + n1.x * o, p1.y + n1.y * o, 0);
      const D = pr(p0.x + n0.x * o, p0.y + n0.y * o, ROAD.wall);
      const E = pr(p1.x + n1.x * o, p1.y + n1.y * o, ROAD.wall);
      if (!A || !B || !D || !E) return;
      let path = buckets.get(colour);
      if (!path) buckets.set(colour, (path = new Path2D()));
      path.moveTo(A.x, A.y);
      path.lineTo(B.x, B.y);
      path.lineTo(E.x, E.y);
      path.lineTo(D.x, D.y);
      path.closePath();
    }
  }

  /**
   * One piece of grandstand: a front wall, raked seating full of crowd, a
   * back wall and a roof. The crowd texture is laid on with an affine map
   * keyed to the distance along the track, so it runs on seamlessly from
   * piece to piece.
   */
  function drawStand(
    i: number,
    side: 1 | -1,
    project: (x: number, y: number, up?: number) => Vec | null,
  ): void {
    if (!ctx) return;
    const j = i + piece;
    const pt = (idx: number, o: number, up: number) => {
      const p = at(idx);
      const n = nrm[wrap(idx)]!;
      return project(p.x + n.x * o * side, p.y + n.y * o * side, up);
    };
    const R = ROAD;
    const fill = (colour: string | CanvasPattern, pts: (Vec | null)[]) => {
      if (pts.some((v) => !v)) return false;
      ctx.beginPath();
      pts.forEach((v, k) => (k ? ctx.lineTo(v!.x, v!.y) : ctx.moveTo(v!.x, v!.y)));
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
      return true;
    };

    // Back wall (the band between the top row and the roof).
    fill(C.standBack, [
      pt(i, R.standBack, R.standHigh - 0.5),
      pt(j, R.standBack, R.standHigh - 0.5),
      pt(j, R.standBack, R.standRoof),
      pt(i, R.standBack, R.standRoof),
    ]);

    // Seating, with the crowd mapped on.
    const A = pt(i, R.standBack, R.standHigh);
    const B = pt(j, R.standBack, R.standHigh);
    const D = pt(i, R.standFront, R.standLow);
    const E = pt(j, R.standFront, R.standLow);
    if (A && B && D && E) {
      fill(C.seats, [A, B, E, D]);
      if (crowd && Math.abs(B.x - A.x) + Math.abs(B.y - A.y) > 3) {
        const K = R.crowdScale;
        const s0 = wrap(i) * step * K;
        const du = piece * step * K;
        const V = 120;
        const a = (B.x - A.x) / du;
        const b = (B.y - A.y) / du;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.lineTo(E.x, E.y);
        ctx.lineTo(D.x, D.y);
        ctx.closePath();
        ctx.clip();
        ctx.transform(a, b, (D.x - A.x) / V, (D.y - A.y) / V, A.x - a * s0, A.y - b * s0);
        ctx.fillStyle = crowd;
        // A little wider than the piece so neighbouring pieces meet without seams.
        ctx.fillRect(s0 - 4, 0, du + 8, V);
        ctx.restore();
      }
    }

    // Front wall, with a red stripe along its top.
    fill(C.standWall, [
      pt(i, R.standFront, 0),
      pt(j, R.standFront, 0),
      pt(j, R.standFront, R.standLow),
      pt(i, R.standFront, R.standLow),
    ]);
    fill(C.red, [
      pt(i, R.standFront, R.standLow - 0.5),
      pt(j, R.standFront, R.standLow - 0.5),
      pt(j, R.standFront, R.standLow),
      pt(i, R.standFront, R.standLow),
    ]);

    // Roof: we see its underside from the car; a light edge along the front.
    const front = R.standFront + 2;
    fill(C.standUnder, [
      pt(i, R.standBack, R.standRoof),
      pt(j, R.standBack, R.standRoof),
      pt(j, front, R.standRoof),
      pt(i, front, R.standRoof),
    ]);
    fill(C.standRoof, [
      pt(i, front, R.standRoof),
      pt(j, front, R.standRoof),
      pt(j, front, R.standRoof + 0.8),
      pt(i, front, R.standRoof + 0.8),
    ]);

    // A roof post every few pieces.
    if (wrap(i) % (piece * 4) < piece) {
      const g = pt(i, front, R.standLow);
      const t = pt(i, front, R.standRoof);
      if (g && t) {
        ctx.strokeStyle = C.standPost;
        ctx.lineWidth = Math.max(1, Math.abs(t.y - g.y) / 40);
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }
    }
  }

  /** The sun and a few clouds, fixed to the compass so they swing round as you turn. */
  function sunAndClouds(horizon: number, yaw: number, F: number): void {
    if (!ctx) return;
    const ox = w * cx;
    const onScreen = (ang: number) => {
      const rel = Math.atan2(Math.sin(ang - yaw), Math.cos(ang - yaw));
      return Math.abs(rel) < 1.2 ? ox + Math.tan(rel) * F : null;
    };

    const sx = onScreen(-2.3);
    if (sx !== null) {
      const sy = horizon - h * 0.32;
      const r = h * 0.35;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      glow.addColorStop(0, `rgb(${C.sun} / 1)`);
      glow.addColorStop(0.08, `rgb(${C.sun} / 0.95)`);
      glow.addColorStop(0.3, `rgb(${C.sun} / 0.3)`);
      glow.addColorStop(1, `rgb(${C.sun} / 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }

    ctx.fillStyle = C.cloud;
    for (let c = 0; c < 9; c++) {
      const ang = c * 0.71 + 0.3;
      const x = onScreen(ang);
      if (x === null) continue;
      const y = horizon - h * (0.12 + ((c * 37) % 5) * 0.05);
      const size = h * (0.035 + ((c * 13) % 4) * 0.012);
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      for (let b = 0; b < 5; b++) {
        const bx = x + (b - 2) * size * 0.9;
        const by = y - Math.sin((b / 4) * Math.PI) * size * 0.5;
        ctx.moveTo(bx + size, by);
        ctx.ellipse(bx, by, size, size * 0.6, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Two layers of rolling hills and a tree line, fixed to the compass. */
  function hills(horizon: number, yaw: number, F: number, pad: number, lk: number): void {
    if (!ctx) return;
    const ox = w * cx;
    const layer = (colour: string, scale: number, seed: number) => {
      ctx.beginPath();
      ctx.moveTo(-pad, horizon + 1);
      for (let x = -pad; x <= w + pad; x += 6) {
        const ang = yaw + Math.atan((x - ox) / F);
        const n =
          Math.sin(ang * 3 + seed) * 0.5 +
          Math.sin(ang * 7 + seed * 2.3) * 0.3 +
          Math.sin(ang * 17 + seed * 0.7) * 0.2 +
          (seed > 2 ? Math.abs(Math.sin(ang * 61)) * 0.35 : 0);
        ctx.lineTo(x, horizon - (0.6 + n * 0.5) * scale * (1 - lk));
      }
      ctx.lineTo(w + pad, horizon + 1);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
    };
    layer(C.hillFar, h * 0.07, 1.2);
    layer(C.hillNear, h * 0.035, 3.4);
  }

  /** Chequered strip across the road at the start/finish line. */
  function chequers(project: (x: number, y: number, up?: number) => Vec | null): void {
    if (!ctx) return;
    const cols = 10;
    const rowsN = 2;
    const depth = 1.4;
    const p = at(0);
    const t = tan[0]!;
    const n = nrm[0]!;
    for (let r = 0; r < rowsN; r++) {
      for (let c = 0; c < cols; c++) {
        const o0 = -ROAD.half + ((ROAD.half * 2) / cols) * c;
        const o1 = o0 + (ROAD.half * 2) / cols;
        const d0 = r * depth;
        const d1 = d0 + depth;
        const corner = (o: number, d: number) =>
          project(p.x + n.x * o + t.x * d, p.y + n.y * o + t.y * d);
        const q = [corner(o0, d0), corner(o1, d0), corner(o1, d1), corner(o0, d1)];
        if (q.some((v) => !v)) return;
        ctx.beginPath();
        q.forEach((v, k) => (k ? ctx.lineTo(v!.x, v!.y) : ctx.moveTo(v!.x, v!.y)));
        ctx.closePath();
        ctx.fillStyle = (r + c) % 2 ? '#0a0a0b' : C.kerbWhite;
        ctx.fill();
      }
    }
  }

  /**
   * An upright board, drawn as a flat panel facing the oncoming car. Its
   * corners are projected, then the text is laid onto it with an affine map
   * (close enough to perspective for something this small).
   */
  function drawBoard(
    board: (typeof placed)[number],
    project: (x: number, y: number, up?: number) => Vec | null,
  ): void {
    if (!ctx) return;
    const p = at(board.i);
    const n = nrm[board.i]!;
    const gantry = board.kind === 'gantry';
    // Gantries span the road; corner boards stand on the verge.
    const o0 = gantry ? -ROAD.kerb - 1 : board.side * (ROAD.kerb + 3);
    const o1 = gantry ? ROAD.kerb + 1 : board.side * (ROAD.kerb + 3 + 9);
    const left = Math.min(o0, o1);
    const right = Math.max(o0, o1);
    const bottom = gantry ? 6.5 : 1.2;
    const top = gantry ? 11.5 : 5.6;
    const pt = (o: number, up: number) => project(p.x + n.x * o, p.y + n.y * o, up);

    const TL = pt(left, top);
    const TR = pt(right, top);
    const BL = pt(left, bottom);
    const BR = pt(right, bottom);
    if (!TL || !TR || !BL || !BR) return;
    if (Math.abs(TR.x - TL.x) < 6) return; // too far away to read

    // Posts.
    ctx.strokeStyle = C.post;
    ctx.lineWidth = Math.max(1, (TR.x - TL.x) / (gantry ? 60 : 30));
    for (const o of gantry ? [left, right] : [left + 1, right - 1]) {
      const g = pt(o, 0);
      const t = pt(o, bottom);
      if (!g || !t) continue;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }

    // Panel, with the content mapped onto local units 0..W × 0..H.
    const W = 300;
    const H = (W * (top - bottom)) / (right - left);
    ctx.save();
    ctx.transform(
      (TR.x - TL.x) / W,
      (TR.y - TL.y) / W,
      (BL.x - TL.x) / H,
      (BL.y - TL.y) / H,
      TL.x,
      TL.y,
    );
    ctx.fillStyle = C.board;
    ctx.strokeStyle = C.boardEdge;
    ctx.lineWidth = 3;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeRect(0, 0, W, H);
    ctx.fillStyle = C.red;
    ctx.fillRect(0, 0, W, H * 0.09);
    ctx.textBaseline = 'middle';
    if (gantry) {
      ctx.fillStyle = C.red;
      ctx.fillRect(14, H * 0.24, 54, H * 0.62);
      ctx.fillStyle = C.text;
      ctx.textAlign = 'center';
      ctx.font = `700 ${H * 0.36}px "JetBrains Mono", monospace`;
      ctx.fillText(board.num, 41, H * 0.56);
      ctx.textAlign = 'left';
      ctx.font = `700 ${H * 0.34}px "Space Grotesk", sans-serif`;
      ctx.fillText(board.title, 82, H * 0.56, W - 96);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = C.text;
      ctx.font = `700 ${H * 0.42}px "JetBrains Mono", monospace`;
      ctx.fillText(board.num, W / 2, board.title ? H * 0.46 : H * 0.56, W - 24);
      if (board.title) {
        ctx.fillStyle = C.muted;
        ctx.font = `500 ${H * 0.16}px "JetBrains Mono", monospace`;
        ctx.fillText(board.title, W / 2, H * 0.8, W - 24);
      }
    }
    ctx.restore();
  }

  return { resize, draw, bendAhead, length };
}

export type Road = NonNullable<ReturnType<typeof createRoad>>;
