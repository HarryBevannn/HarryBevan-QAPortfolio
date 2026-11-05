/**
 * TIMINGS: every animation duration, delay and easing in one place.
 * All values are in seconds (GSAP's unit) unless noted.
 *
 * Tweak the feel of the whole start sequence here without touching the
 * timeline code in the sibling files.
 */
export const TIMINGS = {
  /** Step 1: the safety guard swings up and out sideways on its left-hand hinge. */
  guard: {
    lift: 0.6, // time to swing out past the open position
    overshootDeg: 122, // swings this far...
    openDeg: 106, // ...then settles back to this angle
    liftTiltDeg: 12, // free edge rises slightly as it swings
    liftZ: 10, // px it pops up off the console as it starts to move
    settle: 0.45,
    settleEase: 'elastic.out(1, 0.45)',
    lower: 0.35,
  },

  /** Step 2: the START button depresses and flashes. */
  button: {
    press: 0.09,
    release: 0.22,
    flash: 0.35,
    exit: 0.5, // button cluster fades away so the dash can take over
  },

  /** Engine start: first-person cockpit comes alive. */
  ignition: {
    sharpen: 1.1, // cockpit blur to clear
    needleUp: 0.7, // dials sweep to max...
    needleHold: 0.12,
    needleDown: 0.8, // ...and back to rest
    warningsOn: 0.08,
    warningsHold: 0.7,
    revLedStagger: 0.035, // rev-counter LEDs firing in sequence
    revLedHold: 0.15,
    rumbleShake: 0.045, // one shake step
    rumbleRepeats: 36,
    rumbleAmount: 2.5, // px
  },

  /** Five red start lights. */
  startLights: {
    leadIn: 0.25, // pause after ignition before light 1
    step: 0.45, // gap between each light
    hold: 0.8, // all five red before they switch to green
    greenHold: 0.3, // green "go" before the car launches
    greenFade: 0.25,
  },

  /** Lights out: the start screen falls away and the car rolls up to the line in first person. */
  launch: {
    duration: 1.7, // roll from the grid slot to the start/finish line
    from: 70, // track-plan units behind the line the car starts from
    ease: 'power3.out',
    cockpitExit: 0.9, // start-screen cockpit fades into the live view
  },

  /** Tyre smoke as the car pulls off (skipped under reduced motion). */
  smoke: {
    coverPuffs: 6, // big clouds rolling up from the bottom of the screen
    coverOpacity: 0.85,
    coverDuration: 2.2,
    trailPuffs: 22, // stream from the rear tyres
    trailOpacity: 0.8,
    trailDuration: 2.1,
    emitFor: 1.2, // seconds the tyres keep smoking
    fishtail: 1.1,
  },

  /** Name, role and scroll cue arrive on the hero. */
  hero: {
    words: 0.7,
    wordStagger: 0.08,
    role: 0.6,
    cue: 0.5,
    overlap: 0.55, // starts this long before the launch ends
  },

  /** Scroll-driven lap. */
  lap: {
    scrub: 0.6, // smoothing (seconds to catch up with the scrollbar)
    arrive: 0.55, // car reaches a section's waypoint when the section's top is this far down the viewport
    topSpeed: 199, // mph cap for the scroll-speed readout
    drift: 9, // max degrees the car slides sideways through a corner
    brakeHold: 0.35, // seconds the brake lights stay on after the scroll stops
    steer: 24, // max degrees the steering wheel turns (more and it swings off screen)
    tyreSteer: 0.28, // front tyres turn this fraction of the wheel's angle
    lean: 2.2, // max degrees the view rolls into a corner
    yaw: 4, // max degrees the view slides wide through a corner
  },

  /** After the flag the camera climbs out to the top-down map (scrubbed by scroll). */
  review: {
    start: 'top 95%', // pull-up begins as the "Lap complete" section enters...
    end: 0.15, // ...and the camera is fully overhead with it this far down (or just under the mobile windscreen)
    mapScale: 1.25, // the top-down map settles from this zoom
  },

  /** "Break it" (Telemetry): the front-left wheel comes off (src/animations/crash.ts). */
  crash: {
    hop: 0.25, // wheel hops off the hub
    fly: 1.3, // ...and bounces away down the road
    lurch: 3, // degrees the car drops onto the bare corner
    shake: 0.5, // camera shake on impact
    refit: 0.6, // "Fix it": the wheel flies back on
  },

  /** Content arriving on scroll (skipped under reduced motion). */
  reveal: {
    distance: 28, // px each panel rises
    duration: 0.7,
    stagger: 0.08,
    tilt: 9, // degrees panels tip back as they rise
    chipStagger: 0.03,
    parallax: 45, // % the big ghost section numbers drift past
  },

  /** prefers-reduced-motion: fades only, no rotation, shake, zoom or sweep. */
  reduced: {
    fade: 0.3,
    lightStep: 0.18,
    lightsHold: 0.3,
    greenHold: 0.3,
    exit: 0.45,
  },
} as const;
