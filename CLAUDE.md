# CLAUDE.md

Read this at the start of every session. Keep it current: update it (and the
README) whenever structure, decisions or status change.

## 1. Project

Harry Bevan's personal brand / **portfolio** website (deliberately not a CV). The concept is **one lap of a racing
circuit** (original, loosely inspired by Silverstone's layout). The visitor starts the
car themselves:

1. Start screen: a "Harry Bevan / Lead Quality AI Engineer Portfolio" title (`site.product`)
   above the start lights, carbon
   fibre and a blurred first-person cockpit, with a fighter-cockpit style ENGINE START panel:
   etched legends, a hazard-striped surround, a square push button that lights up when armed,
   and a slim side-hinged red guard. Hint: "Lift the guard to start".
2. Step 1: lift the guard (it swings up and out sideways in 3D, with overshoot). START glows. Hint: "Press START".
3. Step 2: press START. The button depresses and flashes, the cockpit sharpens, the dials
   sweep, warning lights blink, rev LEDs fire, the camera rumbles, and five red start
   lights come on one by one (a countdown beep each), then all turn green for "go".
4. Lights out: the start-screen cockpit falls away into the live **first-person view**
   (`DriverView`), tyre smoke rolls up and the car rolls up to the line. The hero ("Harry
   Bevan", "Lead Quality AI Engineer", "Scroll to drive") animates in.
5. Scrolling drives the lap in first person. Each part of the track is a portfolio section, in
   order: hero → "A portfolio that tests itself" (with Telemetry: live results, Break it, AI
   evals) → "From requirement to test cases" (test-design demo) → "Admin that files itself"
   (Power Automate + AI) → contact (LinkedIn only). A gantry over the road announces each section; corner
   boards stand before each turn. After contact, "Lap complete" (`LapReview`): the camera climbs
   out and pitches down, then hands over to the **top-down map** (Track + Car) with splits and
   markers that link back to each section.
6. The road, maps and page react to each other (`src/animations/lap.ts`, skipped under reduced
   motion):
   - The road (`src/animations/road.ts`, 2D canvas) is projected from the same track path as the
     maps. The wheel turns with the bends, the view leans and slides, rev LEDs and speed streaks
     follow scroll speed (`--lap-speed`).
   - Mini-maps (mobile top bar, desktop PitWall) show the car, the driven trail and a dot per
     section: red while reading it, green once passed.
   - The finish map's markers link to their sections. Pointing at a section lights its markers.
   - A passed marker turns green with a split time.
   - Titles wipe in (`.is-in`), the ghost numbers move with parallax, and panels tilt up.
   - Chips pop in. CSS for these effects sits under `html.lap-fx`, so nothing is hidden
     without it.

The site is its own QA case study: every control has a `data-testid`, and the Telemetry
section shows the Playwright results of the CI run that deployed it.

This is a public portfolio, **not** a "looking for work" page. Tone: confident,
professional, a bit playful.

## 2. About Harry

- Harry Bevan, Lead Quality AI Engineer; 9+ years in QA / test engineering
- **No employers, past roles or employer work anywhere in this repo** (site, code, docs, tests,
  commits). Harry's call: the repo is public. Don't name a company even to test for its absence
- GitHub: HarryBevannn
- Contact on the site is **LinkedIn only** (Harry's call); `site.links.email` is an unused
  placeholder

## 3. Tech stack (and why)

- **Astro** (static output, TS strict): ships HTML first with minimal JS, so the portfolio is
  crawlable and works without JS. Built-in CSP hashing (`security.csp`).
- **GSAP + ScrollTrigger + MotionPathPlugin**: precise, revertible timelines (`gsap.context`)
  and a path-following car. Plugins are lazy-loaded with the lap.
- **Plain CSS + custom properties**, mobile-first: no framework weight; one theme file.
- **Inline SVG** for button, dashboard, car and track: crisp, tiny and stylable. No 3D or WebGL.
- **2D canvas** for the first-person road: a hand-rolled pinhole projection of the track path
  (`road.ts`), redrawn only when the car moves. Cheap, and no WebGL or 3D library.
- **@fontsource** (Space Grotesk + JetBrains Mono): self-hosted, so there are no third-party requests.
- **Playwright + @axe-core/playwright**: real-browser E2E and accessibility gates.
- **ESLint + Prettier**: consistent, linted code.
- **GitHub Pages via GitHub Actions**: free static hosting, deployed only after checks pass.
- **Node 24 LTS** (`.nvmrc`).

## 4. Commands

```
npm run dev        # dev server (CSP not enforced in dev)
npm run build      # astro check + build to dist/
npm run preview    # serve dist/
npm test           # builds, then Playwright (desktop + mobile Chromium). SKIP_BUILD=1 to reuse dist/
npm run test:ui    # Playwright UI mode
npm run lint       # ESLint
npm run format     # Prettier --write
npm run verify     # lint + format:check + build + test (what CI runs)
npm run generate:assets  # og.png, apple-touch-icon.png
```

## 5. Where to edit things

- `src/data/metrics.ts`: the hero's headline numbers
- **No CV on the site.** No `/cv` page, PDF, download links, dated role timeline, skills
  inventory or education. Harry keeps his CV privately and sends it when asked. Don't add one back
  (it would also put CV details in the public repo).
- (Removed: `src/data/cv.ts`, `src/pages/cv.astro`, `public/cv.pdf`, and the PDF step in
  `scripts/generate-assets.mjs`; the PDF step refused to write a file containing an email or
  phone number)
- `src/data/lap.ts`: **portfolio sections and case studies** (content, order, track waypoints).
  **Case studies are this site and demos only: no employer or client work** (Harry's call)
- `src/data/testDesign.ts`: the test-design demo (user story, acceptance criteria, analysis, 14
  test cases, coverage). Each case's `automatedBy` must name a real Playwright test:
  `tests/test-design.spec.ts` checks it
  Waypoints must stay in lap order, so reorder content by swapping it between sections
- `src/data/track.ts`: circuit waypoints and **corner names** ("Turn 1"...)
- `src/data/site.ts`: name, role, links, SEO text, storage key
- `src/animations/timings.ts`: **all animation timings** in one object
- `src/animations/*.ts`: timelines (`ignition`, `engineStart`, `launch`, `lap`)
- `src/animations/road.ts`: the first-person road renderer. Tune the camera, road widths and
  colours in its `ROAD` / `C` constants (daytime palette, crowd texture, grandstand shape);
  gantries and corner boards come from `lap.ts` and `corners` in `track.ts`, and **grandstands**
  from the `stands` list in `DriverView.astro` (waypoint, length, side)
- `src/components/DriverView.astro`: the cockpit (original open-wheel car: nose and front wing,
  both front tyres on wishbones, mirrors, race wheel with gloves and rev LEDs). **Mobile
  (< 900px):** the view is a fixed windscreen band (`--windscreen-h` in theme.css) above the
  text (`--z-windscreen`), with the mini-map bar and Replay/Sound buttons on its sky; the page's
  `scroll-padding-top` keeps anchors and focus below it. Desktop: full screen behind the text
- `src/scripts/sound.ts` (cue API; on by default, mute remembered in localStorage) and
  `src/scripts/soundSynth.ts` (Web Audio synth: clicks, modelled V8 engine, crackles, wheelspin,
  countdown beeps; fetched in idle time) and `src/scripts/engineModel.ts` (the cold-start V8,
  rendered pulse by pulse; tune the `coldStart` / `idleLoop` / `pullAway` scripts) and
  `src/scripts/music.ts` (the **original soundtrack**: chords in `BARS`, melody in `HOOK`, tempo
  `BPM`; swells under the lights, drops at launch, loops for the lap, opens up with scroll speed)
- `src/animations/tyreSmoke.ts`: launch smoke (puffs in the `TyreSmoke` overlay) and fishtail
- `src/scripts/intro-controller.ts`: stage state machine (`intro → armed → starting → track`),
  skip, replay, session memory, sound toggle, aria-live
- `src/styles/theme.css`: **colours, fonts, spacing**, layers
- `src/components/`: StartScreen, IgnitionButton, Cockpit, StartLights, DriverView (road canvas
  - original open-wheel cockpit frame), PitWall (desktop dash: live HUD, mini-map, sector nav),
    MiniMap (`bar` on mobile, `dash` in PitWall), LapSection, LapBlock (content blocks), LapReview
    (top-down finish map: Track + Car), Backdrop (animated carbon background), SkipIntro,
    HudControls, TestRun (Telemetry: live test results)
- `src/lib/testResults.ts`: the `/test-results.json` format. `tests/support/results-reporter.ts`
  (custom Playwright reporter) writes it to `dist/`; `src/scripts/testRun.ts` loads and replays it;
  `src/scripts/liveChecks.ts` holds the in-browser checks behind "Run live checks". "View tests"
  under Passed / Failed / Skipped lists that outcome's tests from the same JSON and scrolls the
  list into view (Passed includes flaky; Failed's and Skipped's links only show if the run has such tests); visual tests
  there get a "Screenshots" dialog
- `src/scripts/breakIt.ts` (the bugs "Break it" plants and undoes) and `src/animations/crash.ts`
  (the wheel coming off, timings in `TIMINGS.crash`); cockpit hooks `data-driver-hub`,
  `-arm`, `-sparks`, `-gear` in DriverView
- `evals/`: the **AI evals scorecard** (recorded, not live: Harry's call). `assistant.ts` (the
  Pit wall assistant's system prompt, built from dist/index.html's visible text, with a canary
  and refusal phrases), `cases.ts` (the 16 questions and their checks; edit here),
  `answers.json` (answers recorded once by Claude Opus 5.5 playing the assistant),
  `judge.ts` + `judgements.json` (recorded LLM judge marks out of 100; each verdict stores the
  answer it marked, so re-judge any answer you change), `score.ts`
  - `run.ts` (`npm run evals` writes `public/eval-results.json`; commit it). Format in
    `src/lib/evalResults.ts`; UI in `src/components/AiEvals.astro` + `src/scripts/aiEvals.ts`.
    `tests/evals.spec.ts` re-scores the answers and fails if the published file doesn't match.
    No model calls anywhere (no keys, no CI step). Answers are shown as text only (never
    innerHTML) and redacted before publishing
- `tests/visual.spec.ts`: visual regression. Baselines in `tests/visual.spec.ts-snapshots/`,
  **one set per OS** (`-win32`, `-linux`). After an intended visual change: `npm run
test:visual:update` for Windows, and the "Update visual baselines" workflow
  (`.github/workflows/visual-baselines.yml`, run by hand) for Linux: download its artifact and
  commit the PNGs, or CI fails
- `tests/`: Playwright specs. `tests/support/static-server.ts` serves dist/ in-process
- `.github/workflows/ci.yml`: CI and Pages deploy

Gotchas:

- **Every `button`, `a[href]` and `summary` needs a unique kebab-case `data-testid`**
  (`area-thing`, e.g. `sector-link-telemetry`). `tests/test-run.spec.ts` enforces it on `/` and
  the 404, and so does the site's own live check. Tests locate controls by test id (helpers in
  `tests/helpers.ts`); assert accessible names separately (`toHaveAccessibleName`).
- `dist/test-results.json` only exists after `npm test`. `npm run build` wipes it, and the
  Telemetry section then says "No test results in this build". Keep the results privacy-safe:
  titles, outcomes and timings only, never error text, paths or attachments. The one exception
  is visual.spec.ts screenshots (of this public site), copied to `dist/visual/`.
- `public/eval-results.json` is generated by `npm run evals`: never edit it by hand (the test
  compares it with a fresh scoring).
- Reduced motion gives **every** property a 0.01ms transition (global.css), so for an instant
  after a class/stage change things can still be "hidden" (focus fails). See `focusHero()` in
  intro-controller.

- CSP has no `'unsafe-inline'`: **never write `style="..."` in markup**. Use classes, or set
  styles from JS/GSAP (CSSOM writes are allowed). Check CSP with build + preview, not dev.
- SVG presentation attributes can't read CSS variables. Use hex values (mirrored from
  theme.css) or CSS classes.
- `<html data-stage>` drives which screen shows. The head script in BaseLayout sets it
  before first paint from sessionStorage.
- Prefer `fromTo()` over `from()` for reveal tweens built mid-sequence. A `from()` with
  `autoAlpha` once captured 0 as its end value in reduced-motion mode and left the hero hidden.
- Astro 7 `preview` manages its own server process and allows only one per project.
  `astro preview stop` clears a stale one.

## 6. Non-negotiable rules

- **No real logos or trademarks** (no F1, Silverstone, Lamborghini or team logos or liveries).
  Original car, cockpit, button and track artwork only. Corner names stay generic until Harry renames them.
- **Accessibility**: visible "Skip intro" as the first focusable element; full keyboard
  operation; visible focus; correct ARIA labels and states; aria-live announcements;
  `prefers-reduced-motion` means fades only (no shake, zoom or scroll-jacking) and the content
  reads as a normal page; never hijack native scroll; remember the intro in sessionStorage
  (try/catch) plus "Replay start"; sound is ON by default (Harry's call) but nothing plays before the visitor's own click, with a
  one-tap mute that is remembered; tyre smoke and other motion are skipped under reduced motion; semantic HTML that works without JS.
- **Performance**: Lighthouse 95+ in all four categories; no heavy 3D or WebGL; lazy-load
  anything the intro doesn't need.
- **Privacy & content**: the repo and its history are public. Never add a phone number, home
  address or personal email (site, code, metadata, commits). No secrets, API keys or
  tokens. No employer or client work: case studies are this site and demos built on it. Mark
  copy that needs Harry's check with a `TODO`.
- **Quality**: every feature ships with Playwright tests. Run `npm run lint` and `npm test`
  (or `npm run verify`) before calling a task done. Keep CI green.
- **Docs**: update README.md and this file when structure or decisions change.

## 7. Deployment

- Public repo `HarryBevan-QAPortfolio` → custom domain **https://harrybevan.uk** (Cloudflare
  Registrar, `public/CNAME`; DNS records "DNS only"), served at the root: `site` set, no `base`.
  Still build internal URLs with `withBase()` from `src/data/site.ts` (never hard-code `/og.png`);
  the test server mirrors the base (`BASE` in `tests/support/static-server.ts`).
- GitHub Actions: lint, format, build and tests on every PR and every push to main. Deploys to
  Pages **only** on a push to main after every check passes (`pages: write`, `id-token: write`,
  `contents: read`).
- Pages Source must be "GitHub Actions". No custom headers on Pages, so CSP and referrer
  policy are meta tags (limitations are in the README).
- Never push on Harry's behalf. Give him the commands.
- Custom domain set up (steps in the README). WHOIS: .uk individuals are redacted by the
  registry, and Cloudflare redacts its own WHOIS.

## 8. Status & roadmap

**Done (Nov 2026):** start sequence (polished), track and car, scroll-driven lap scaffold
with placeholder sections, mobile mini-map, reduced-motion and no-JS paths, CSP, SEO and
OG meta, synthesised sound (on by default), tyre-smoke launch, real content, race-track styling with live HUD, data-testid on every control, live test results section (CI replay + in-browser checks),
interactive track (clickable markers, sector splits) and scroll effects, first-person lap
(canvas road, gantries, steering wheel, mini-maps, pull-up to the top-down finish map), tests
(119 passing + 15 skips: 1 desktop-only, 1 mobile-only, 3 engine-model unit tests that run once), CI and deploy
workflow.

**Next:**

1. Harry checks the Power Automate flow's details (the TODO in `lap.ts`)
2. Testimonials
3. Lighthouse scores fed from CI (the Playwright results are live; Lighthouse is hand-updated in `lap.ts`)
4. (Custom domain: done, harrybevan.uk)

## 9. Decision log

- **2026-11**: Racing-lap concept chosen over a plane theme.
- **2026-11**: Visitor-operated flip-guard start button (two deliberate steps), not an autoplay intro.
- **2026-11**: Carbon fibre and blurred cockpit background, all CSS/SVG with no images.
- **2026-11**: GitHub Pages chosen over Netlify: the site is static and the code can be public.
- **2026-11**: Custom domain purchase left until the site is finished. Then bought:
  **harrybevan.uk** at Cloudflare Registrar (at-cost renewals, free WHOIS redaction), over GoDaddy.
- **2026-11**: CSP via Astro's `security.csp` meta tag (hashed, no `'unsafe-inline'`), because Pages
  can't set headers.
- **2026-11**: Start screen gets a name/role title. The guard became a side-hinged, extruded 3D lid
  that swings out sideways, replacing the top-hinged flip.
- **2026-11**: Sound is synthesised with Web Audio (no audio files or licensing) and stays off by
  default. The start lights now finish green for "go", with a countdown beep per red light.
- **2026-11**: Harry switched sound to ON by default (reversing the earlier off-by-default rule).
  Audio still only starts on the visitor's click; mute is remembered. The engine synth was rebuilt
  as a modelled V8, and tyre smoke was added to the launch transition.
- **2026-11**: Real content added, public-safe: no phone or personal email. The original CV file
  is never committed. (Later removed with the portfolio/CV split.)
- **2026-11**: UI pass: animated carbon backdrop, lighter palette, kerb motif, race-track styling,
  pit-wall HUD (scroll-speed, lap %), reveals, count-ups, lap timer.
- **2026-11**: Tests serve `dist/` from an in-process server in Playwright's global setup instead
  of `webServer` + `astro preview`. On Windows, Playwright's process-tree kill of the preview
  server took minutes.
- **2026-11**: Skills & stats moved straight after the hero (Harry's call), ahead of Career.
- **2026-11**: Every control gets a `data-testid` and tests locate by it. The site itself becomes
  the "build & test" case study: CI's Playwright results are written to `dist/test-results.json`
  and shown, with a replay, in the Telemetry section. Playwright can't run in a browser, so the
  visitor-run part is ten honest in-browser checks, clearly labelled as live.
- **2026-11**: Case studies now follow the hero, and Skills & stats is trimmed to two new stats and
  one toolkit list (the full set stays on `/cv`). The hero intro now says why the site exists: a
  CV that ships with its own test results.
- **2026-11**: The engine was rebuilt as a cold-start V8 rendered from individual combustion
  pulses (cross-plane firing order), because the oscillator version sounded like a toy. The start
  button became a slim, etched fighter-cockpit panel, because the chunky round one felt bulky.
- **2026-11**: The site is now named "Lead Quality AI Engineer Portfolio" (page title, start
  screen, footer and social card). The track was made interactive: its markers are links to
  their sections, and passed sectors show split times. The car now reacts to scrolling, and
  more scroll effects were added. All of it is decoration gated on `html.lap-fx`, so it's
  absent under reduced motion and without JS.
- **2026-11**: Harry's upgrade: the lap is driven **in first person** instead of watching a
  top-down car. The road is a 2D canvas projected from the real track path (no WebGL), so the
  mini-map always matches the bends. Scroll still drives (native scroll, no paging). The
  top-down view survives only as the "Lap complete" map at the finish, reached by a scrubbed
  camera pull-up. The lap module now loads on START so the road is ready at lights out.
- **2026-11**: The race is in daytime (sky, sun, clouds, mown verges, gravel traps, tyre walls)
  with grandstands and crowds, and the cockpit is a detailed original open-wheel car whose front
  tyres steer with the wheel. The cockpit is sized by screen height (it was cut off on wide
  screens) and the wheel turns at most 24°.
- **2026-11**: Harry asked for the F1 Movie theme. It's copyrighted, so it can't ship on a public
  site/repo without a licence; instead there's an **original synthesised soundtrack** in the same
  driving film-score mood (no copied melody, no audio files). It starts only after the visitor's
  own click (START sequence, Skip intro, or switching sound back on) and follows the mute button.
  Never add commercial music files to this repo.
- **2026-11**: Repo history rebuilt as one clean commit (no personal email in authorship) and
  published as the public repo `HarryBevan-QAPortfolio` (Harry's name choice), so the site
  serves under a `base` sub-path until the custom domain.
- **2026-11**: Mobile layout: the text kept running across the road and wheel, so on phones the
  driver view became a fixed windscreen band at the top with the text scrolling beneath it
  (Harry's request to fix the overlap). The finish pull-up ends just under the band on mobile.
- **2026-11**: AI evals scorecard (Harry's pick): a "Pit wall assistant" grounded on the published
  page, scored on grounding, admitting unknowns, privacy, prompt injection and scope. Live runs
  were tried first (GitHub Models, retired 30 July 2026; then Groq, which needed a key), and
  Harry chose **recorded** instead: Claude Opus 5.5 played the assistant once, the answers are
  committed, and code scores them (a test re-scores on every run). No keys, costs or limits; the
  site labels it as a recorded run.
- **2026-11**: LLM judge added to the AI evals (Harry's request): each recorded answer also gets a
  recorded mark out of 100. Claude Opus 5.5 answers and **Claude Fable 5.1 judges**, seeing only the
  page text, questions and replies, so the site can say "independently marked by a different
  model". Keep that wording true: if answers change, re-judge them with a model other than the one
  that answered.
- **2026-11**: Two show-off features (Harry's picks): **Break it** in Telemetry knocks the
  front-left wheel off and plants three real bugs for the live checks to catch and name; **Fix
  it** repairs both. And **visual regression** with Playwright screenshots, published with the
  results so each visual test in the Telemetry list opens its baseline / this build / diff.
  Linux baselines come from a hand-run workflow (no Docker or WSL on Harry's PC).
- **2026-11**: Portfolio and CV split (Harry's call). The site is a portfolio only: the `/cv` page,
  `cv.pdf`, every CV download link, Skills & stats, Career and Experience & education are gone.
  Experience was folded into the case studies.
- **2026-11**: Case studies anonymised (Harry's call): no employer or client work. The
  employer case studies and a side-project case study are gone. The lap
  is now Start → A portfolio that tests itself (with Telemetry and the AI evals) → From
  requirement to test cases (a test-design demo on the start sequence, whose coverage matrix
  found a real gap: TC-05, now a test) → Admin that files itself (Power Automate + AI) →
  Contact (LinkedIn only). The hero's numbers are now about the site, not employer results.
  The hero shows only Harry's title: no employer or location line (`site.company`/`location` are
  gone), and an eval checks the assistant doesn't name an employer.
