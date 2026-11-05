/**
 * Lap: the visitor drives the circuit in first person as they scroll, and the
 * page comes alive around them. Lazy-loaded (on START, or straight away for a
 * returning visitor), so ScrollTrigger and MotionPathPlugin never block the
 * intro.
 *
 * The view through the windscreen is src/animations/road.ts, projected from
 * the same track path as the mini-maps, so the bends ahead are the bends on
 * the map. The steering wheel turns with them and the rev LEDs follow the
 * scroll speed. After the flag, the camera climbs out to the top-down map
 * (LapReview) as it scrolls in.
 *
 * Native scrolling is never hijacked: ScrollTrigger only *reads* the scroll
 * position. Each LapSection carries data-progress (its waypoint's lap
 * progress, from src/data/lap.ts); the car reaches that waypoint as the
 * section's top crosses TIMINGS.lap.arrive of the viewport, interpolating
 * along the track in between.
 *
 * Also here: the live HUDs (sector, speed from scroll velocity, lap %), the
 * sector nav state, stat count-ups, scroll reveals and the lap timer.
 *
 * The maps and page are tied together both ways: each marker turns green
 * with a split time once the car passes it, pointing at a section lights its
 * marker, and the finish map's markers are links back into the page.
 *
 * Reduced motion: no continuous movement, reveals, count-ups, lean or car
 * effects, and no pull-up. The road view, car and HUDs simply jump to
 * whichever section is being read; split times still appear, without
 * animation.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { TIMINGS } from './timings';
import { createRoad, type Road, type RoadBoard } from './road';
import { sound } from '../scripts/sound';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

interface PathPosition {
  x: number;
  y: number;
  angle?: number;
}

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string) => [...document.querySelectorAll<T>(sel)];

const setText = (els: (HTMLElement | null)[], text: string) =>
  els.forEach((el) => {
    if (el && el.textContent !== text) el.textContent = text;
  });

export interface LapControls {
  /** The car rolling from its grid slot up to the line (the launch). */
  rollIn(): gsap.core.Timeline;
  /** Park on the line, e.g. after Skip or Replay cut a launch short. */
  settle(): void;
}

export function initLap(reduced: boolean): LapControls | null {
  const path = $<SVGPathElement>('[data-track-path]');
  const car = $<SVGGElement>('[data-car]');
  const sections = $$<HTMLElement>('[data-lap-section]');
  if (!path || !car || sections.length === 0) return null;

  const trails = [$<SVGPathElement>('[data-trail]'), ...$$<SVGPathElement>('[data-mini-trail]')];
  const dots = $$<SVGCircleElement>('[data-mini-dot]');
  const bars = [$<HTMLElement>('[data-hud-bar]'), $<HTMLElement>('[data-mini-bar]')];
  const sectorText = [$<HTMLElement>('[data-hud-sector]'), $<HTMLElement>('[data-mini-sector]')];
  const progressText = [
    $<HTMLElement>('[data-hud-progress]'),
    $<HTMLElement>('[data-mini-progress]'),
  ];
  const speedText = [$<HTMLElement>('[data-hud-speed]'), $<HTMLElement>('[data-mini-speed]')];
  const lapTime = $<HTMLElement>('[data-lap-time]');
  const lapStart = performance.now();
  let lapDone = false;
  // Each section's marker on the finish map and its dot on every mini-map.
  const markers = sections.map((s) =>
    $$<Element>(`[data-marker="${s.id}"], [data-mini-marker="${s.id}"]`),
  );

  // The track, mini-maps, car and road share one coordinate space, so one RawPath serves all.
  const rawPath = MotionPathPlugin.cacheRawPathMeasurements(MotionPathPlugin.getRawPath(path));
  const progressAt = sections.map((s) => Number(s.dataset.progress ?? 0));

  const view = initDriverView(rawPath, reduced);
  const state = { p: 0, speed: 0 };

  let heading = 0;
  /** Draw the car, trails, HUD % and progress bars at lap progress p (0..1). */
  const render = (p: number) => {
    const pos = MotionPathPlugin.getPositionOnPath(
      rawPath,
      Math.min(p, 0.9999),
      true,
    ) as PathPosition;
    heading = pos.angle ?? 0;
    car.setAttribute('transform', `translate(${pos.x} ${pos.y}) rotate(${heading})`);
    dots.forEach((d) => d.setAttribute('transform', `translate(${pos.x} ${pos.y})`));
    const offset = String(1 - p);
    trails.forEach((t) => t && (t.style.strokeDashoffset = offset));
    bars.forEach((b) => b && (b.style.transform = `scaleX(${p})`));
    setText(progressText, String(Math.round(p * 100)));
    view?.draw(p);
  };

  /** Stop the lap clock the first time the chequered flag comes into view. */
  const finishLap = () => {
    if (lapDone || !lapTime) return;
    lapDone = true;
    lapTime.textContent = lapClock(performance.now() - lapStart);
  };

  /**
   * Sector splits: the first time a section is reached, its marker shows the
   * lap time so far, and every marker behind the car turns green.
   */
  const clearSectors = (index: number) => {
    markers.forEach((group, i) => i < index && group.forEach((m) => m.classList.add('is-cleared')));
    const split = $<SVGTextElement>(`[data-split="${sections[index]?.id}"]`);
    if (!split || split.textContent) return;
    split.textContent = lapClock(performance.now() - lapStart).slice(0, -1);
    if (!reduced) {
      gsap.fromTo(
        split,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: 'back.out(2)' },
      );
    }
  };

  // Highlight the section being read: its marker, nav link and the HUD sector.
  sections.forEach((section, index) => {
    const marker = markers[index] ?? [];
    const link = $(`[data-sector-link="${section.id}"]`);
    // Pointing at a section lights its marker on the maps.
    section.addEventListener('pointerenter', () =>
      marker.forEach((m) => m.classList.add('is-hover')),
    );
    section.addEventListener('pointerleave', () =>
      marker.forEach((m) => m.classList.remove('is-hover')),
    );
    ScrollTrigger.create({
      trigger: section,
      start: `top ${TIMINGS.lap.arrive * 100}%`,
      end: `bottom ${TIMINGS.lap.arrive * 100}%`,
      onToggle: ({ isActive }) => {
        section.classList.toggle('is-active', isActive);
        marker.forEach((m) => m.classList.toggle('is-active', isActive));
        if (isActive) link?.setAttribute('aria-current', 'location');
        else link?.removeAttribute('aria-current');
        if (!isActive) return;
        setText(sectorText, section.dataset.sector ?? '');
        clearSectors(index);
        if (section.querySelector('[data-finish]')) finishLap();
        if (reduced) render(Number(section.dataset.progress ?? 0));
      },
    });
  });

  // The launch: roll up from a grid slot behind the line (the road view only).
  const controls: LapControls = {
    rollIn: () => {
      const back = { units: TIMINGS.launch.from };
      return gsap.timeline().fromTo(
        back,
        { units: TIMINGS.launch.from },
        {
          units: 0,
          duration: TIMINGS.launch.duration,
          ease: TIMINGS.launch.ease,
          onUpdate: () => view?.draw(state.p, back.units),
        },
      );
    },
    settle: () => view?.draw(state.p),
  };

  if (reduced) {
    render(0);
    return controls;
  }

  document.documentElement.classList.add('lap-fx');
  initReveals();
  initSectionFx(sections);
  initReview(view);
  const carFx = initCarFx(car);

  // Scroll positions at which the car reaches each section's waypoint.
  let stops: number[] = [];
  const measure = () => {
    const max = ScrollTrigger.maxScroll(window);
    const arriveAt = window.innerHeight * TIMINGS.lap.arrive;
    let last = 0;
    stops = sections.map((s, i) => {
      if (i === 0) return 0;
      const top = s.getBoundingClientRect().top + window.scrollY - arriveAt;
      last = Math.min(Math.max(top, last + 1), max);
      return last;
    });
  };

  const progressForScroll = (y: number): number => {
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1]!;
      const b = stops[i]!;
      if (y <= b) {
        const t = b > a ? (y - a) / (b - a) : 1;
        return (
          progressAt[i - 1]! + (progressAt[i]! - progressAt[i - 1]!) * gsap.utils.clamp(0, 1, t)
        );
      }
    }
    return progressAt.at(-1) ?? 1;
  };

  // Smooth the car towards the scroll-driven target (visual easing only;
  // the page itself scrolls natively).
  const driveTo = gsap.quickTo(state, 'p', {
    duration: TIMINGS.lap.scrub,
    ease: 'power3.out',
    onUpdate: () => {
      render(state.p);
      carFx.steer(heading);
    },
  });

  // Speed readout: scroll velocity mapped to a plausible mph, easing back to 0.
  const showSpeed = () => {
    setText(speedText, String(Math.round(state.speed)));
    carFx.speed(state.speed / TIMINGS.lap.topSpeed);
    view?.speed(state.speed / TIMINGS.lap.topSpeed);
    sound.drive(state.speed / TIMINGS.lap.topSpeed);
  };
  const speedTo = gsap.quickTo(state, 'speed', {
    duration: 0.35,
    ease: 'power2.out',
    onUpdate: showSpeed,
  });
  let coast: number | undefined;

  measure();
  ScrollTrigger.addEventListener('refresh', measure);
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      driveTo(progressForScroll(self.scroll()));
      speedTo(Math.min(TIMINGS.lap.topSpeed, Math.abs(self.getVelocity()) / 8));
      // Scrolling back up counts as braking.
      if (self.direction < 0) carFx.brake();
      window.clearTimeout(coast);
      coast = window.setTimeout(() => {
        speedTo(0);
        carFx.brake();
      }, 160);
    },
    onRefresh: (self) => driveTo(progressForScroll(self.scroll())),
  });

  state.p = progressForScroll(window.scrollY);
  render(state.p);
  // Web fonts can shift section positions slightly once loaded (and the road's boards use them).
  void document.fonts?.ready.then(() => {
    ScrollTrigger.refresh();
    view?.draw(state.p);
  });
  return controls;
}

/**
 * The driver view: sizes the road canvas, draws it (at most once a frame),
 * turns the steering wheel with the bends ahead and lights the rev LEDs with
 * the speed. Without the canvas or a 2D context it returns null and the lap
 * carries on without it.
 */
function initDriverView(rawPath: RawPath, reduced: boolean) {
  const layer = $<HTMLElement>('[data-driver]');
  const canvas = $<HTMLCanvasElement>('[data-road]');
  if (!layer || !canvas) return null;

  let boards: RoadBoard[] = [];
  try {
    boards = JSON.parse(canvas.dataset.boards ?? '[]') as RoadBoard[];
  } catch {
    // Boards are decoration; drive on without them.
  }
  const road: Road | null = createRoad(
    canvas,
    (t) => MotionPathPlugin.getPositionOnPath(rawPath, t, false) as PathPosition,
    boards,
  );
  if (!road) return null;

  const wheel = layer.querySelector<SVGGElement>('[data-driver-wheel]');
  const tyres = [...layer.querySelectorAll<SVGGElement>('[data-driver-tyre]')];
  const leds = [...layer.querySelectorAll<SVGElement>('[data-driver-led]')];
  const l = TIMINGS.lap;
  const cam = { p: 0, back: 0, lift: 0, speed: 0 };
  let queued = 0;

  const paint = () => {
    queued = 0;
    const p = cam.p - cam.back / road.length;
    const bend = reduced ? 0 : road.bendAhead(p); // radians, + = right
    const grip = 0.35 + 0.65 * cam.speed; // lean and slide grow with speed
    const k = gsap.utils.clamp(-1, 1, bend / 1.6);
    const inCar = 1 - cam.lift;
    road.draw({
      p,
      lift: cam.lift,
      yaw: k * l.yaw * grip * inCar,
      roll: -k * l.lean * grip * inCar,
    });
    const turn = gsap.utils.clamp(-1, 1, bend / 2) * l.steer;
    wheel?.setAttribute('transform', `rotate(${turn.toFixed(1)} 800 840)`);
    // The front tyres follow the wheel, at a much smaller angle.
    const toe = (turn * l.tyreSteer).toFixed(2);
    tyres.forEach((t) =>
      t.setAttribute('transform', `rotate(${toe} ${t.dataset.cx ?? 0} ${t.dataset.cy ?? 0})`),
    );
  };
  const request = () => {
    queued ||= requestAnimationFrame(paint);
  };

  const size = () => {
    const cx = parseFloat(getComputedStyle(layer).getPropertyValue('--driver-cx')) || 50;
    road.resize(cx / 100);
    paint();
  };
  size();
  window.addEventListener('resize', size);

  return {
    layer,
    /** Draw at lap progress p, `back` plan units behind it (the launch roll). */
    draw(p: number, back = 0) {
      cam.p = p;
      cam.back = back;
      request();
    },
    /** 0..1 of top speed: lights the rev LEDs and sets how hard the view leans. */
    speed(k: number) {
      cam.speed = gsap.utils.clamp(0, 1, k);
      const lit = Math.round(cam.speed * leds.length);
      leds.forEach((led, i) => led.setAttribute('opacity', i < lit ? '1' : '0'));
      request();
    },
    /** 0 = in the cockpit, 1 = looking down from above. */
    lift(k: number) {
      cam.lift = k;
      request();
    },
  };
}

type DriverView = NonNullable<ReturnType<typeof initDriverView>>;
type RawPath = ReturnType<typeof MotionPathPlugin.getRawPath>;

/**
 * After the flag: as "Lap complete" scrolls in, the camera climbs out of the
 * cockpit and pitches down over the circuit, the cockpit frame drops away,
 * and the road view hands over to the top-down map, which settles into place.
 * Scrubbed by the scroll, so scrolling back up drops you back into the car.
 */
function initReview(view: DriverView | null): void {
  const review = $<HTMLElement>('[data-lap-review]');
  const map = review?.querySelector<HTMLElement>('[data-track-zoom]');
  if (!review || !map) return;
  const frame = view?.layer.querySelector<HTMLElement>('[data-driver-frame]');
  const r = TIMINGS.review;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: review,
      start: r.start,
      // On mobile, sections stop just under the windscreen band (the page's
      // scroll-padding), so the climb must be finished by then.
      end: () => {
        const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        return `top ${Math.max(pad, window.innerHeight * r.end)}px`;
      },
      invalidateOnRefresh: true,
      scrub: true,
    },
  });
  if (view) {
    const climb = { k: 0 };
    tl.fromTo(climb, { k: 0 }, { k: 1, duration: 1, onUpdate: () => view.lift(climb.k) }, 0);
    tl.fromTo(view.layer, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.35 }, 0.65);
    if (frame) {
      tl.fromTo(frame, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: 80, duration: 0.3 }, 0);
    }
  }
  tl.fromTo(
    map,
    { scale: r.mapScale, autoAlpha: 0.15 },
    { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'power1.out' },
    0.5,
  );
}

/** Lap clock format, e.g. 1:02.345. */
function lapClock(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`;
}

/**
 * The car reacts to the scroll: it slides a few degrees sideways through
 * corners, a speed streak stretches out behind it, and the brake lights come
 * on when the visitor scrolls back or stops. The page's speed lines follow the
 * same speed (via --lap-speed on <html>).
 */
function initCarFx(car: SVGGElement) {
  const body = car.querySelector<SVGGElement>('[data-car-body]');
  const streak = car.querySelector<SVGPathElement>('[data-car-streak]');
  const brakeLights = car.querySelector<SVGGElement>('[data-car-brake]');
  const root = document.documentElement;
  const max = TIMINGS.lap.drift;

  const yawTo = body
    ? gsap.quickTo(body, 'rotation', { duration: 0.5, ease: 'power2.out' })
    : () => undefined;
  let last: number | undefined;
  let release: gsap.core.Tween | undefined;

  return {
    /** Call after the car moves to a new heading: yaw into the turn, then straighten up. */
    steer(angle: number) {
      if (last !== undefined) {
        const turn = ((angle - last + 540) % 360) - 180; // shortest way round
        yawTo(gsap.utils.clamp(-max, max, turn * 2.5));
      }
      last = angle;
      release?.kill();
      release = gsap.delayedCall(0.12, () => yawTo(0));
    },
    /** Speed as a fraction (0..1) of top speed. */
    speed(k: number) {
      const v = gsap.utils.clamp(0, 1, k);
      if (streak) {
        streak.setAttribute('opacity', (v * 0.9).toFixed(3));
        streak.setAttribute(
          'transform',
          `translate(-20 0) scale(${(0.2 + v * 1.1).toFixed(3)} 1) translate(20 0)`,
        );
      }
      root.style.setProperty('--lap-speed', v.toFixed(3));
    },
    brake() {
      if (!brakeLights) return;
      gsap.killTweensOf(brakeLights);
      gsap
        .timeline()
        .to(brakeLights, { opacity: 1, duration: 0.06 })
        .to(brakeLights, { opacity: 0, duration: 0.25 }, `+=${TIMINGS.lap.brakeHold}`);
    },
  };
}

/**
 * Section effects, all decoration on top of content that's already readable:
 *   - titles wipe in behind a kerb stripe the first time they arrive (.is-in)
 *   - the big ghost section numbers drift past at a different speed (parallax)
 */
function initSectionFx(sections: HTMLElement[]): void {
  const r = TIMINGS.reveal;
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top < window.innerHeight * 0.8) {
      section.classList.add('is-in');
    } else {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 80%',
        end: 'max',
        once: true,
        onEnter: () => section.classList.add('is-in'),
      });
    }

    const ghost = section.querySelector('.lap-section__ghost');
    if (ghost) {
      gsap.fromTo(
        ghost,
        { yPercent: -r.parallax },
        {
          yPercent: r.parallax,
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      );
    }
  });
}

/**
 * Sections and cards rise and tip upright as they arrive, then their
 * chips pop in one after another. Only elements still below the fold are
 * hidden first, so nothing already on screen (or already passed) can ever be
 * left invisible.
 */
function initReveals(): void {
  const r = TIMINGS.reveal;
  revealBelow(
    '[data-reveal]',
    { y: r.distance, rotationX: r.tilt, transformPerspective: 900, transformOrigin: '50% 0%' },
    { y: 0, rotationX: 0, duration: r.duration, stagger: r.stagger, ease: 'power3.out' },
    'top 92%',
  );
  revealBelow(
    '.chip-list > li',
    { scale: 0.8, y: 8 },
    { scale: 1, y: 0, duration: 0.4, delay: 0.15, stagger: r.chipStagger, ease: 'back.out(2.2)' },
    'top 94%',
  );
}

function revealBelow(
  selector: string,
  from: gsap.TweenVars,
  to: gsap.TweenVars,
  start: string,
): void {
  const below = [...document.querySelectorAll<HTMLElement>(selector)].filter(
    (el) => el.getBoundingClientRect().top > window.innerHeight,
  );
  if (below.length === 0) return;
  gsap.set(below, { autoAlpha: 0, ...from });
  ScrollTrigger.batch(below, {
    start,
    once: true,
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, overwrite: true, ...to }),
  });
}
