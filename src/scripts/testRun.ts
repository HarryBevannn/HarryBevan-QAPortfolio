/**
 * Telemetry: this site's own test results.
 *
 *   - Loads /test-results.json (written into dist/ by the Playwright run in CI)
 *     when the section nears the viewport, and fills in the totals.
 *   - "Replay the CI run" streams every test line by line, like Playwright's
 *     list reporter, with each test's real outcome and timing.
 *   - "Run live checks" runs real assertions in the visitor's browser
 *     (src/scripts/liveChecks.ts).
 *   - "View tests" under Passed, Failed and Skipped lists every test with
 *     that outcome in the console, straight away (no replay). Visual tests
 *     get a "Screenshots" button that opens their images in a dialog.
 *   - "Break it" knocks the front-left wheel off (src/animations/crash.ts)
 *     and plants real bugs (./breakIt.ts) for the live checks to catch;
 *     "Fix it" undoes both.
 *
 * Playwright itself can't run inside a web page, so the copy says plainly
 * which results came from CI and which ran live. Reduced motion: lines
 * appear all at once.
 */
import {
  formatDuration,
  totalsOf,
  type TestResult,
  type TestResultsSummary,
  type TestShots,
  type TestStatus,
} from '../lib/testResults';
import { announce } from './announcer';
import { prefersReducedMotion } from './motion';
import { sound } from './sound';

/** A replay takes about this long, however many tests there are. */
const REPLAY_MS = 4200;
const ICON: Record<TestStatus, string> = { passed: '✓', failed: '✘', flaky: '±', skipped: '–' };

interface Line {
  status: TestStatus;
  text: string;
  meta: string;
  /** Visual tests: opens their screenshots. */
  shots?: { shots: TestShots; title: string; project: string };
}

/** "desktop-chromium the hero" -> "desktop-chromium-the-hero", for test ids. */
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function initTestRun(root: HTMLElement): void {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const ui = {
    badge: q('[data-test-run-badge]'),
    status: q('[data-test-run-status]'),
    meta: q('[data-test-run-meta]'),
    replay: q<HTMLButtonElement>('[data-test-run-replay]'),
    live: q<HTMLButtonElement>('[data-test-run-live]'),
    brk: q<HTMLButtonElement>('[data-test-run-break]'),
    brkIcon: q('[data-break-icon]'),
    brkLabel: q('[data-break-label]'),
    shots: q<HTMLDialogElement>('[data-shots]'),
    bar: q('[data-test-run-bar]'),
    counter: q('[data-test-run-counter]'),
    console: q<HTMLOListElement>('[data-test-run-console]'),
    scroll: q('[data-test-run-scroll]'),
    ciLink: q<HTMLAnchorElement>('[data-test-run-ci]'),
    ciLabel: q('[data-ci-label]'),
  };
  const total = (key: string) => q(`[data-total="${key}"]`);
  const views = [...root.querySelectorAll<HTMLButtonElement>('[data-test-run-view]')];
  const enableViews = (on: boolean) => views.forEach((v) => (v.disabled = !on));
  const pressView = (key?: string) =>
    views.forEach((v) => v.setAttribute('aria-pressed', String(v.dataset.testRunView === key)));

  let results: TestResultsSummary | undefined;
  let timer: number | undefined;

  const setBadge = (state: 'pending' | 'passed' | 'failed', text: string) => {
    if (ui.badge) ui.badge.dataset.status = state;
    if (ui.status) ui.status.textContent = text;
  };

  const setTotals = (t: TestResultsSummary['totals'], durationMs: number) => {
    total('passed')!.textContent = String(t.passed + t.flaky);
    total('failed')!.textContent = String(t.failed);
    total('skipped')!.textContent = String(t.skipped);
    total('duration')!.textContent = formatDuration(durationMs);
  };

  const line = ({ status, text, meta, shots }: Line): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = `test-run__line test-run__line--${status}`;
    li.dataset.status = status;
    const icon = document.createElement('span');
    icon.className = 'test-run__icon';
    icon.setAttribute('aria-label', status);
    icon.textContent = ICON[status];
    const body = document.createElement('span');
    body.className = 'test-run__text';
    body.textContent = text;
    const small = document.createElement('span');
    small.className = 'test-run__meta-line';
    small.textContent = meta;
    body.append(small);
    if (shots) body.append(shotsButton(shots));
    li.append(icon, body);
    return li;
  };

  const note = (text: string, kind = 'muted') => {
    const li = document.createElement('li');
    li.className = `test-run__line test-run__line--${kind}`;
    li.textContent = text;
    return li;
  };

  /** Stream lines into the console, then call done(). */
  const stream = (header: string, lines: Line[], done: () => void) => {
    window.clearTimeout(timer);
    const out = ui.console!;
    const toEnd = () => {
      if (ui.scroll) ui.scroll.scrollTop = ui.scroll.scrollHeight;
    };
    out.replaceChildren(note(header));
    root.dataset.running = 'true';
    for (const b of [ui.replay, ui.live, ui.brk]) if (b) b.disabled = true;
    enableViews(false);
    pressView();

    const finish = () => {
      delete root.dataset.running;
      if (ui.replay) ui.replay.disabled = !results;
      if (ui.live) ui.live.disabled = false;
      if (ui.brk) ui.brk.disabled = false;
      enableViews(!!results);
      done();
      toEnd(); // keep the summary line in view
    };

    const progress = (n: number) => {
      if (ui.bar) ui.bar.style.transform = `scaleX(${lines.length ? n / lines.length : 1})`;
      if (ui.counter) ui.counter.textContent = `${n}/${lines.length}`;
    };

    if (prefersReducedMotion()) {
      out.append(...lines.map(line));
      progress(lines.length);
      finish();
      return;
    }

    const step = Math.max(12, REPLAY_MS / Math.max(lines.length, 1));
    let i = 0;
    const tick = () => {
      const next = lines[i];
      if (!next) return finish();
      out.append(line(next));
      toEnd();
      progress(++i);
      timer = window.setTimeout(tick, step);
    };
    progress(0);
    tick();
  };

  const summaryLine = (t: TestResultsSummary['totals'], ms: number) => {
    const parts = [`${t.passed} passed`];
    if (t.flaky) parts.push(`${t.flaky} flaky`);
    if (t.failed) parts.push(`${t.failed} failed`);
    if (t.skipped) parts.push(`${t.skipped} skipped`);
    return `${parts.join(', ')} (${formatDuration(ms)})`;
  };

  const toLine = (t: TestResult): Line => ({
    status: t.status,
    text: [...t.suite, t.title].join(' › '),
    meta: `${t.project} · ${t.file} · ${t.status === 'skipped' ? 'skipped' : formatDuration(t.durationMs)}`,
    ...(t.shots ? { shots: { shots: t.shots, title: t.title, project: t.project } } : {}),
  });

  // ── Screenshots of a visual test ────────────────────────────
  const SHOT_KINDS: { key: keyof TestShots; caption: string }[] = [
    { key: 'baseline', caption: 'Baseline (approved)' },
    { key: 'actual', caption: 'This build' },
    { key: 'diff', caption: 'Difference' },
  ];
  /** Image paths in the JSON are relative to the JSON itself. */
  const shotUrl = (path: string) =>
    new URL(path, new URL(root.dataset.resultsUrl ?? 'test-results.json', document.baseURI)).href;

  function openShots({ shots, title, project }: NonNullable<Line['shots']>): void {
    const dialog = ui.shots;
    if (!dialog) return;
    dialog.querySelector('[data-shots-title]')!.textContent = `Screenshots: ${title}`;
    dialog.querySelector('[data-shots-meta]')!.textContent =
      `${project} · ${shots.diff ? 'this build differs from the baseline' : 'matches the baseline'}`;
    const figures = SHOT_KINDS.filter((k) => shots[k.key]).map(({ key, caption }) => {
      const figure = document.createElement('figure');
      const img = document.createElement('img');
      img.src = shotUrl(shots[key]!);
      img.alt = `${caption}: ${title}, ${project}`;
      img.decoding = 'async';
      const cap = document.createElement('figcaption');
      cap.textContent = caption;
      figure.append(img, cap);
      return figure;
    });
    dialog.querySelector('[data-shots-grid]')!.replaceChildren(...figures);
    dialog.showModal();
  }

  function shotsButton(target: NonNullable<Line['shots']>): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'test-run__shots';
    button.dataset.testid = `test-shots-${slug(`${target.project} ${target.title}`)}`;
    button.setAttribute('aria-haspopup', 'dialog');
    button.textContent = '📷 Screenshots';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = ` for ${target.title}, ${target.project}`;
    button.append(sr);
    button.addEventListener('click', () => openShots(target));
    return button;
  }

  const dialog = ui.shots;
  dialog?.querySelector('[data-shots-close]')?.addEventListener('click', () => dialog.close());
  // A click on the backdrop (outside the dialog's box) closes it too.
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  // ── View one outcome: every passed, failed or skipped test ──
  // "Passed" includes flaky tests (they passed on a retry), matching its total.
  const VIEW: Record<string, { statuses: TestStatus[]; word: string }> = {
    passed: { statuses: ['passed', 'flaky'], word: 'passed' },
    failed: { statuses: ['failed'], word: 'failed' },
    skipped: { statuses: ['skipped'], word: 'skipped' },
  };
  views.forEach((button) => {
    button.addEventListener('click', () => {
      const view = VIEW[button.dataset.testRunView ?? ''];
      if (!results || !view || root.dataset.running) return;
      window.clearTimeout(timer);
      const tests = results.tests.filter((t) => view.statuses.includes(t.status));
      const out = ui.console!;
      out.replaceChildren(
        note(`# ${view.word} in the CI run that shipped this build: ${tests.length}`),
        ...tests.map((t) => line(toLine(t))),
      );
      if (tests.length === 0) {
        out.append(note(`No tests ${view.word} in this run.`, 'passed'));
      }
      if (ui.bar) ui.bar.style.transform = 'scaleX(1)';
      if (ui.counter) ui.counter.textContent = `${tests.length} ${view.word}`;
      if (ui.scroll) {
        ui.scroll.scrollTop = 0;
        ui.scroll.focus({ preventScroll: true });
      }
      pressView(button.dataset.testRunView);
      announce(`Showing ${tests.length} ${view.word} ${tests.length === 1 ? 'test' : 'tests'}.`);
    });
  });

  // ── Replay the CI run ───────────────────────────────────────
  ui.replay?.addEventListener('click', () => {
    if (!results) return;
    const r = results;
    const lines = r.tests.map(toLine);
    stream(
      `$ npx playwright test   # ${r.projects.length} projects, ${r.tests.length} tests`,
      lines,
      () => {
        ui.console!.append(
          note(summaryLine(r.totals, r.durationMs), r.totals.failed ? 'failed' : 'passed'),
        );
        announce(`Replay finished: ${summaryLine(r.totals, r.durationMs)}.`);
      },
    );
  });

  // ── Live checks in this browser ─────────────────────────────
  ui.live?.addEventListener('click', () => {
    void import('./liveChecks').then(({ runLiveChecks }) => {
      const checks = runLiveChecks();
      const lines: Line[] = checks.map((c) => ({
        status: c.pass ? 'passed' : 'failed',
        text: c.name,
        meta: `live · ${c.detail} · ${c.durationMs.toFixed(1)}ms`,
      }));
      stream('$ live checks   # running in your browser, right now', lines, () => {
        const failed = checks.filter((c) => !c.pass).length;
        const text = `${checks.length - failed} passed${failed ? `, ${failed} failed` : ''} in your browser`;
        ui.console!.append(note(text, failed ? 'failed' : 'passed'));
        if (failed && root.dataset.broken) {
          ui.console!.append(
            note('Caught the planted bugs. Press “Fix it” to send in the pit crew.'),
          );
        }
        announce(`Live checks finished: ${text}.`);
      });
    });
  });

  // ── Break it / Fix it ───────────────────────────────────────
  const setBreakButton = (broken: boolean) => {
    if (ui.brkIcon) ui.brkIcon.textContent = broken ? '🔧' : '💥';
    if (ui.brkLabel) ui.brkLabel.textContent = broken ? 'Fix it' : 'Break it';
  };

  ui.brk?.addEventListener('click', () => {
    if (root.dataset.running) return;
    void Promise.all([import('./breakIt'), import('../animations/crash')]).then(([bugs, car]) => {
      const reduced = prefersReducedMotion();
      window.clearTimeout(timer);
      pressView();
      if (ui.bar) ui.bar.style.transform = 'scaleX(0)';
      if (ui.counter) ui.counter.textContent = '';
      if (!bugs.isBroken()) {
        const n = bugs.breakPage();
        car.crash(reduced);
        sound.play('crash');
        root.dataset.broken = 'true';
        setBreakButton(true);
        ui.console!.replaceChildren(
          note('# 💥 Front-left wheel off! Something in this page broke with it.', 'failed'),
          note(`${n} real bugs were just planted. Press “Run live checks” to find them.`),
        );
        announce(
          `The front-left wheel came off, and ${n} bugs were planted in this page. Run live checks to find them.`,
        );
      } else {
        const fixed = bugs.fixPage();
        car.repair(reduced);
        sound.play('repair');
        delete root.dataset.broken;
        setBreakButton(false);
        ui.console!.replaceChildren(
          note('# 🔧 Pit stop: wheel back on, every bug fixed.', 'passed'),
          ...fixed.map((f) => note(`fixed: ${f}`)),
          note('Run the live checks again to prove it.'),
        );
        announce('Pit stop done: the wheel is back on and the bugs are fixed.');
      }
    });
  });

  // ── Load the results of the run that shipped this build ─────
  const load = async () => {
    try {
      const res = await fetch(root.dataset.resultsUrl ?? 'test-results.json', {
        cache: 'no-cache',
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as TestResultsSummary;
      if (!Array.isArray(data.tests)) throw new Error('bad results');
      results = { ...data, totals: totalsOf(data.tests) };
    } catch {
      setBadge('pending', 'No test results in this build');
      if (ui.meta) ui.meta.textContent = 'Results are added by the CI run (npm test locally).';
      return;
    }
    const r = results;
    const passed = r.status === 'passed' && r.totals.failed === 0;
    setBadge(passed ? 'passed' : 'failed', passed ? 'All checks passed' : 'Failures in this run');
    setTotals(r.totals, r.durationMs);
    const when = new Date(r.generatedAt).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    if (ui.meta) {
      ui.meta.textContent = `Playwright ${r.playwrightVersion} · ${r.projects.join(' + ')} · ${when}${r.ci ? ` · commit ${r.ci.commit}` : ''}`;
    }
    if (r.ci && ui.ciLink) {
      ui.ciLink.href = r.ci.runUrl;
      if (ui.ciLabel) ui.ciLabel.textContent = 'This run on GitHub Actions';
    }
    if (ui.replay) ui.replay.disabled = false;
    enableViews(true);
  };

  // Fetch only when the section is getting close.
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void load();
    },
    { rootMargin: '600px 0px' },
  );
  io.observe(root);
}
