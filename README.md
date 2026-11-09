# Harry Bevan: one lap of the circuit

**Lead Quality AI Engineer Portfolio**: the personal brand / portfolio site of
**Harry Bevan**, Lead Quality AI Engineer.

You start the car yourself: lift the safety guard, press **START**, watch the
dash come alive and the five start lights go green. Then you stay in the seat:
the car rolls up to the line, and scrolling drives the lap **in first person**.
Each part of the track is a section of the portfolio, and a gantry over the road
announces each one as you approach it.

The road, the maps and the page react to each other:

- The road ahead is projected from the real circuit, so every bend you drive is
  the bend on the map. The steering wheel turns with it, the view leans and
  slides through corners, the rev LEDs and speed streaks follow your scroll speed,
  and corner boards stand on the way into each turn.
- It's race day: blue sky, sun and clouds, gravel traps and tyre walls, and
  grandstands packed with crowd on the main straight and the big corners. From
  the seat you see the nose, the front wing and both front tyres on their
  suspension, steering with the wheel.
- On a phone the road and cockpit sit in a windscreen band across the top of
  the screen, with the text scrolling up beneath it, so words never run across
  the animation. On desktop the road fills the screen beside the text.
- A mini-map (pinned at the top on mobile, on the pit-wall panel on desktop) shows
  where you are. Each section's dot turns red while you read it and green once
  you've passed it.
- After the chequered flag the camera climbs out of the cockpit and looks down
  on the whole circuit. That top-down map shows your split time at every
  section, and its numbered markers link back to each one.
- Section titles wipe in behind a kerb stripe. The big section numbers drift past
  at their own speed, panels tip upright as they rise, and chips pop in.

Live at **https://harrybevan.uk**.

> All artwork (car, cockpit, button and circuit) is original. The circuit is
> loosely inspired by a classic British airfield layout but is not a tracing
> of any real venue. There's no affiliation with any racing series, circuit,
> team or manufacturer, and the site uses no real logos or trademarks.

---

## Quick start

Requires Node 24 LTS (see `.nvmrc`; with nvm run `nvm use`).

```bash
npm install
npm run dev          # http://localhost:4321
```

| Command                   | What it does                                                     |
| ------------------------- | ---------------------------------------------------------------- |
| `npm run dev`             | Dev server with hot reload                                       |
| `npm run build`           | Type-check (`astro check`) and build static output to `dist/`    |
| `npm run preview`         | Serve the built `dist/` locally                                  |
| `npm test`                | Build, then run the Playwright suite (desktop + mobile Chromium) |
| `npm run test:ui`         | Playwright UI mode, for writing and debugging tests              |
| `npm run lint`            | ESLint (TypeScript + Astro)                                      |
| `npm run format`          | Prettier, writing changes                                        |
| `npm run verify`          | Everything CI runs: lint, format check, then build + tests       |
| `npm run generate:assets` | Regenerate `public/og.png` and `apple-touch-icon.png`            |

First time running tests? Install the browser: `npx playwright install chromium`.
Set `SKIP_BUILD=1` to rerun tests against an existing `dist/` without rebuilding.

> **CSP note:** Astro's Content-Security-Policy is only applied to production
> builds. Use `npm run build && npm run preview` (or `npm test`) to check
> anything security-related; `npm run dev` doesn't enforce it.

---

## How it's put together

```
src/
├─ data/
│  ├─ metrics.ts        ← the hero's headline numbers
│  ├─ lap.ts            ← which content goes on which part of the lap
│  ├─ track.ts          ← circuit waypoints and corner names ("Turn 1"...)
│  └─ site.ts           ← name, role, links, SEO text
├─ animations/
│  ├─ timings.ts        ← every duration, delay and easing in one object
│  ├─ ignition.ts       ← guard lift/lower, START press
│  ├─ engineStart.ts    ← cockpit sharpen, needle sweep, warnings, rev LEDs, rumble, start lights
│  ├─ launch.ts         ← lights out: cockpit falls away, roll to the line, hero copy reveal
│  ├─ road.ts           ← first-person road on a 2D canvas, projected from the track path
│  └─ lap.ts            ← scroll-driven lap (lazy-loaded: ScrollTrigger + MotionPathPlugin)
├─ components/          ← StartScreen, IgnitionButton, Cockpit, StartLights, DriverView
│                          (road + cockpit frame), PitWall (HUD + mini-map + sector nav),
│                          MiniMap, LapSection, LapBlock (content blocks), LapReview
│                          (top-down finish map: Track + Car), Backdrop, SkipIntro, HudControls
├─ scripts/
│  ├─ intro-controller.ts  ← state machine: intro → armed → starting → track
│  ├─ storage.ts / announcer.ts / motion.ts / sound.ts
├─ styles/
│  ├─ theme.css         ← colours, fonts, spacing, layers (EDIT THIS for the look)
│  └─ global.css
├─ lib/geometry.ts      ← turns waypoints into a smooth SVG path
├─ layouts/BaseLayout.astro  ← <head>: meta, Open Graph, fonts
└─ pages/index.astro, 404.astro
tests/                  ← Playwright + axe
scripts/generate-assets.mjs
.github/workflows/ci.yml
```

### Editing lap sections

Everything visitors read lives in **`src/data/lap.ts`**. Each section has:

- `id`: the anchor (`/#case-studies`)
- `waypoint`: the named point on the track the car reaches as the section
  scrolls into view (names are defined in `src/data/track.ts`; `'finish'`
  means a full lap)
- `sector`: the label shown on the section and in the mobile mini-map
- `title`, `intro` and `blocks`: content blocks (`cases`, `test-run`, `chips`, `quotes`,
  `finish`, `links`, `text`), rendered by
  `LapBlock.astro`

The lap runs: start (hero) → **A portfolio that tests itself** (the case study, with the
live test results, Break it and the AI evals scorecard under it) → **From requirement to
test cases** (a test-design demo on this site's start sequence, data in
`src/data/testDesign.ts`) → **Admin that files itself** (a Power Automate flow built with
AI) → **Let's talk quality** (LinkedIn only) → the lap from above. The case studies are this
site and demos built on it, deliberately not tied to any employer or client.

Sections are driven in order, so reordering the array reorders the lap.
To rename corners, edit `corners` in `src/data/track.ts`. To reshape the
circuit, move the `waypoints` there: dense points make tight corners and
sparse points make straights.

### Portfolio, not a CV

This site is deliberately a portfolio: there's no CV page, PDF or download, and no dated role
timeline, skills inventory or education. Keep your CV privately and send it when asked. Never
drop a CV file into this repo: the repo is public, and a CV contains your phone number and email.
A test (`accessibility.spec.ts`, "Portfolio, not a CV") fails if a CV page, PDF or link comes back.

### Editing timings

All motion timing is in **`src/animations/timings.ts`**: guard swing and
overshoot, button press, needle sweep, rev LEDs, rumble, start-light gaps,
launch roll, scroll smoothing, steering/lean and the finish pull-up. The
timeline functions only read from
that object.

### Editing the look

Colours, fonts, spacing and layers are CSS custom properties in
**`src/styles/theme.css`**. Fonts (Space Grotesk and JetBrains Mono) are
self-hosted via `@fontsource` and imported in `BaseLayout.astro`.

---

## Accessibility & motion

- **Skip intro** is the first focusable element and jumps straight to the hero.
  After the intro it becomes a standard "Skip to content" link.
- Fully keyboard-operable: Tab to the guard, Enter/Space lifts it (focus moves to
  START), Enter/Space starts the engine. Focus then moves to the page heading.
- State changes are announced through a polite `aria-live` region.
- `prefers-reduced-motion`: fades only, with no 3D swing, needle sweep, shake,
  launch roll or continuous scroll animation. The road view and maps jump between
  sections, and none of the scroll effects run (no title wipes, parallax, lean,
  speed streaks or pull-up). Split times still appear, without animation.
- The first-person view is decorative (`aria-hidden`) and JS-only. Without JS the
  portfolio reads as a plain page that ends with the top-down circuit map.
- Native scrolling is never hijacked. ScrollTrigger only reads the scroll position.
- The intro is remembered for the session (`sessionStorage`, wrapped in
  try/catch). **Replay start** brings it back.
- Sound is **on** by default, but nothing plays until the visitor's own click on
  the guard (browsers require a gesture, and no AudioContext exists before it). One
  tap mutes it, and the choice is remembered (`localStorage`, wrapped in try/catch).
  Sounds: a click as the guard lifts, a clunk on START, then a **cold-start V8**: the
  starter labouring through compression strokes, a stumbling catch, a flare to about
  2,350 rpm and a lumpy fast idle through the lights (a countdown beep per red light,
  a "go" tone on green), then clutch drop, wheelspin squeal, a gear change with a
  crack, and the car fading into the distance.
- **Soundtrack**: an original driving film-score track (`src/scripts/music.ts`),
  synthesised live like everything else, so there are no audio files and nothing to
  license. It swells under the start lights, drops at launch with the beat, loops for
  the lap and opens up as you scroll faster. It also starts after Skip intro (a click)
  or when sound is switched back on, pauses while the tab is hidden, and the same
  mute button silences it.
- The engine isn't an oscillator. `src/scripts/engineModel.ts` renders every
  combustion pulse sample by sample, using a cross-plane firing order
  (1-8-4-3-6-5-7-2), so each bank's exhaust gets uneven pulses (the burble), with
  per-firing variation and misfires. `src/scripts/soundSynth.ts` plays those buffers
  through an exhaust (body and bark resonances, a muffler that opens with load, soft
  saturation). Buffers are rendered once, in idle time after the guard click. No
  audio files ship. To tune it, edit `coldStart`, `idleLoop` and `pullAway` (rpm, load,
  misfire and starter curves) and `IDLE_RPM` in `engineModel.ts`, or the filter
  values in the `Engine` class. `tests/engine-model.spec.ts` checks the shape: quiet
  cranking, a loud flare, the firing rate at idle, and a seamless idle loop.
- Tyre smoke billows as the car pulls off (`src/animations/tyreSmoke.ts`,
  `TIMINGS.smoke`). It uses transform and opacity only, and is skipped under reduced motion.
- Without JavaScript the portfolio is a plain, readable semantic page.
- The axe scans in `tests/accessibility.spec.ts` fail CI on any serious or
  critical violation.

## Testing: the site is its own case study

- **Every control has a `data-testid`** (every `button`, `a[href]` and `summary`), in
  kebab-case: `skip-intro`, `guard`, `start-button`, `replay-start`, `sound-toggle`,
  `hero-scroll-cue`, `hero-contact`, `sector-link-<section>`, `track-marker-<section>`,
  `case-link-<label>`, `test-run-replay`, `test-run-live`, `test-run-break`,
  `test-run-view-<outcome>`, `test-shots-<project>-<test>`, `test-shots-close`, `test-run-ci`,
  `test-results-json`, `contact-<label>`, `back-to-start`. `tests/test-run.spec.ts` fails if any control on `/` or the
  404 page is missing one, or if two share an id. Tests locate controls by test id
  (`tests/helpers.ts`), and `accessibility.spec.ts` separately asserts their accessible
  names, so a11y is still covered.
- **Live results on the site.** `tests/support/results-reporter.ts` is a custom
  Playwright reporter that writes `dist/test-results.json` (titles, outcomes and
  timings only: no error text, paths or attachments, except visual tests' screenshots of
  the site itself, copied to `dist/visual/`). In CI that file is written after
  the build and before `dist/` is uploaded, so each deploy carries the results of the
  run that shipped it. CI only deploys a passing run.
- The **Telemetry** section (`src/components/TestRun.astro`, `src/scripts/testRun.ts`)
  loads that JSON, shows the totals, commit and a link to the Actions run, and can
  **replay the run** line by line. **View tests** under Passed, Failed and Skipped lists
  every test with that outcome straight away and scrolls the list into view (Passed
  includes flaky tests, which passed on a retry; Failed and Skipped only have the link
  when the run has such tests). Playwright can't run inside a web page, so **Run live
  checks** (`src/scripts/liveChecks.ts`) runs ten real assertions in the visitor's
  browser instead: test ids present and unique, accessible names, focus order, heading
  levels, CSP, no personal contact details, safe external links, sound-toggle state and
  section structure. A Playwright test asserts all ten pass.
- **Break it** (`src/scripts/breakIt.ts`, `src/animations/crash.ts`): the front-left wheel
  comes off and bounces away down the road, and three real bugs are planted in the page
  (a control loses its test id, two controls share one, a heading skips a level). Run
  live checks and they're caught and named; **Fix it** sends in the pit crew and undoes
  both. A reload also undoes it. Reduced motion: the wheel just fades.
- **Visual regression** (`tests/visual.spec.ts`): the start screen, the start line, the
  finish map and the 404 page are compared with approved baselines in
  `tests/visual.spec.ts-snapshots/` (one set per OS, as fonts render slightly
  differently on Windows and Linux), under reduced motion so frames are still. In the
  Telemetry list each visual test has a **Screenshots** button: the baseline and this
  build's capture, plus the diff when a comparison fails.
  - After an intended visual change, run `npm run test:visual:update` (Windows
    baselines), then run the **Update visual baselines** workflow on GitHub, download its
    `visual-baselines` artifact and commit the `*-linux.png` files into
    `tests/visual.spec.ts-snapshots/`. CI compares against the Linux set.
- **AI evals scorecard** (`evals/`, shown by `src/components/AiEvals.astro`): a small
  "Pit wall assistant" answers questions about this portfolio using only the published
  page's text. 16 questions in five groups (grounded answers, saying when it doesn't
  know, protecting personal data, resisting prompt injection, staying on topic), each
  scored by deterministic checks (facts, refusal phrases, leak patterns, a planted
  canary). The Telemetry section shows a score per group and every answer with its
  checks.
  - **Recorded, not live** (Harry's call): no model is called in CI or on the page, so
    there are no API keys, costs or rate limits. The answers in `evals/answers.json`
    were recorded once by Claude Opus 5.5 playing the assistant, with the system prompt
    in `evals/assistant.ts`, and the scorecard says so.
  - **LLM judge**: each answer also gets a mark out of 100 against the rubric and prompt in
    `evals/judge.ts` (accuracy 40, follows its rules 30, helpfulness 20, clarity 10). The
    marks are recorded in `evals/judgements.json`, and code adds them up. The judge is a
    different model from the assistant (Claude Fable 5.1, against Claude Opus 5.5), given
    only the page text, the questions and the replies. Each verdict stores
    the answer it marked, so a changed answer loses its marks and fails the tests until
    it's judged again.
  - `npm run evals` scores them and writes `public/eval-results.json` (commit it). A test
    re-scores the answers on every run and fails if the published scorecard doesn't
    match, so it can't drift from the suite.
  - To change the suite: edit `evals/cases.ts`, record answers for any new questions in
    `evals/answers.json`, then `npm run evals`.
  - Published answers are redacted: anything shaped like an email address, phone number
    or postcode is replaced, and answers are shown as text, never HTML.
- `npm run build` on its own produces no results file; the section then says so.
  Run `npm test` and `npm run preview` to see it locally.

## Performance

Measured locally with Lighthouse 12 on the production build (9 Nov 2026, median of
three runs):

|         | Performance | Accessibility | Best practices | SEO |
| ------- | ----------- | ------------- | -------------- | --- |
| Mobile  | 96          | 100           | 100            | 100 |
| Desktop | 99          | 100           | 100            | 100 |

- Inline SVG for all artwork: no images in the critical path, no WebGL. The
  first-person road is a plain 2D canvas, redrawn only when the car moves (at most
  once a frame), so a still page costs nothing.
- GSAP core loads with the page. ScrollTrigger and MotionPathPlugin are split
  into a separate chunk, loaded only once the track is on screen.
- Only the font weights in use are bundled (Latin subset).

## Security headers on GitHub Pages

GitHub Pages can't set custom response headers, so there's no `_headers` or
`netlify.toml` here. Instead:

- **Content-Security-Policy** is emitted as a `<meta http-equiv>` tag by Astro
  (`security.csp` in `astro.config.mjs`). Astro hashes every script and style it
  emits, so the policy has **no `'unsafe-inline'`**. One consequence: never use
  inline `style="..."` attributes in markup. Use classes, or set styles from JS
  (GSAP does this).
- **Referrer-Policy** is a `<meta name="referrer">` tag (`strict-origin-when-cross-origin`).

Limitations of the meta-tag approach:

- `frame-ancestors`, `report-uri`/`report-to` and `sandbox` are **ignored** in
  a meta CSP, so there's no clickjacking protection via CSP and no violation reporting.
- There's no `X-Content-Type-Options`, `Permissions-Policy` or
  `Cross-Origin-*` headers. (HTTPS/HSTS is handled by GitHub on `github.io`.)
- If stronger headers are ever needed, put a CDN (such as Cloudflare) in front
  of the custom domain to add them.

---

## Deployment (GitHub Pages via GitHub Actions)

The repo is public and named **`HarryBevan-QAPortfolio`**. The site is served from
the custom domain **https://harrybevan.uk** (registered at Cloudflare, `public/CNAME`), at
the root, so `astro.config.mjs` sets `site` and no `base`. The old
`harrybevannn.github.io/HarryBevan-QAPortfolio/` address redirects to it. Internal URLs
are still built with `withBase()` from `src/data/site.ts`, and the test server
(`tests/support/static-server.ts`, `BASE`) mirrors the base, so a sub-path could come
back without hunting for hard-coded paths.

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

1. `npm ci`, lint, format check, `astro check` and build
2. installs Playwright Chromium and runs the full test suite (including axe), which
   writes `dist/test-results.json` for the Telemetry section
3. uploads the Playwright HTML report as an artifact (`playwright-report`)
4. **only on a push to `main` where everything passed**: uploads `dist/` and
   deploys with the official `actions/deploy-pages`. The deploy job has just
   `contents: read`, `pages: write` and `id-token: write`.

### One-time setup

1. Create the public repo **`HarryBevan-QAPortfolio`** on GitHub (empty: no
   README, licence or .gitignore).
2. Go to **Settings → Pages → Build and deployment → Source** and choose
   **GitHub Actions**. (Not "Deploy from a branch".)
3. Push `main` (commands are below).
4. Open the **Actions** tab and watch **CI & Deploy**. When both jobs are
   green, the deploy job shows the live URL, and **Settings → Pages** says
   "Your site is live at https://harrybevannn.github.io/HarryBevan-QAPortfolio/".
5. Optional but recommended: **Settings → Branches → Add rule** for `main`,
   requiring the "Lint, build & test" check to pass before merging.

If the deploy job fails with a permissions or environment error, check that
Source is set to **GitHub Actions** and that the `github-pages` environment
exists (GitHub creates it the first time Pages is enabled).

### Keep your email out of commit history

Everything in this repo is public, including commit metadata. Before your first
commit:

1. On GitHub, go to **Settings → Emails** and tick **Keep my email addresses private**
   and **Block command line pushes that expose my email**.
2. Copy your noreply address from that page. It looks like
   `12345678+HarryBevannn@users.noreply.github.com`.
3. In this repo, run `git config user.email "12345678+HarryBevannn@users.noreply.github.com"`
   (add `--global` to use it everywhere).
4. Check it with `git config user.email`.

---

## Custom domain (the very last step)

Leave this until the site is finished. Until then, it lives at the free
`github.io` address.

1. **Buy the domain** and make sure **WHOIS privacy / redaction is ON** at the
   registrar, so your name and home address never appear in public WHOIS records.
2. **Verify the domain with GitHub** (this stops anyone else claiming it on Pages):
   go to your profile **Settings → Pages → Add a domain**, then add the TXT record
   GitHub shows you (`_github-pages-challenge-HarryBevannn.<domain>`) at the
   registrar and click **Verify**.
3. **DNS records** at the registrar:

   | Type  | Host / name | Value                    |
   | ----- | ----------- | ------------------------ |
   | A     | `@`         | `185.199.108.153`        |
   | A     | `@`         | `185.199.109.153`        |
   | A     | `@`         | `185.199.110.153`        |
   | A     | `@`         | `185.199.111.153`        |
   | AAAA  | `@`         | `2606:50c0:8000::153`    |
   | AAAA  | `@`         | `2606:50c0:8001::153`    |
   | AAAA  | `@`         | `2606:50c0:8002::153`    |
   | AAAA  | `@`         | `2606:50c0:8003::153`    |
   | CNAME | `www`       | `harrybevannn.github.io` |

   Check these against GitHub's docs ("Managing a custom domain for your GitHub
   Pages site") at the time. Never use wildcard (`*`) DNS records.

4. In the repo, go to **Settings → Pages → Custom domain**, enter the domain and
   save. Wait for the DNS check to pass.
5. In the code:
   - add `public/CNAME` containing just the domain (e.g. `example.com`). With
     Actions deployments GitHub reads the domain from Settings, but the file
     records it in the repo and does no harm.
   - change `site` in `astro.config.mjs` to `https://<domain>` and remove `base`
   - set `BASE` in `tests/support/static-server.ts` to `'/'`
   - update `url` in `src/data/site.ts`, `public/robots.txt`, `public/sitemap.xml`
     and the canonical/OG expectations in `tests/accessibility.spec.ts`
6. Once the certificate has been issued (can take up to an hour), tick
   **Enforce HTTPS** in **Settings → Pages**.

---

## Privacy & content rules

- This repo is **public**, including its history.
- No phone number, home address or personal email anywhere: not in the site,
  code, metadata or commit history. Contact is LinkedIn only, and a test fails if any
  email address other than the unused placeholder in `site.ts` appears in the page.
- No secrets, API keys or tokens. The site needs none.
- No employer or client work in the case studies: they're this site and demos built on
  it. Copy that still needs Harry's check is marked with a `TODO`.

## TODO

- [ ] Check the Power Automate flow's details in `src/data/lap.ts` (the `TODO` there)
- [ ] Run Lighthouse in CI and feed its scores into the Telemetry section (the Playwright
      results are already live; the Lighthouse readings are hand-updated in `lap.ts`)
- [ ] Collect testimonials (add a `quotes` block in `lap.ts`)
- [ ] Rename corners in `src/data/track.ts`
- [ ] Custom domain (last)
