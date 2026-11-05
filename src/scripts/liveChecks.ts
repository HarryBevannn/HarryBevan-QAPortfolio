/**
 * Live checks: real assertions run in the visitor's own browser against the
 * page they're looking at. They mirror parts of the Playwright suite that
 * make sense without a test runner (test ids, accessible names, headings,
 * CSP, privacy). Loaded on demand by the Telemetry section.
 */
export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
  durationMs: number;
}

interface Check {
  name: string;
  run: () => { pass: boolean; detail: string };
}

const $$ = <T extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];

/** Everything a visitor can press: the elements that must carry a data-testid. */
const CONTROLS = 'button, a[href], summary';
const FOCUSABLE =
  'a[href], button, summary, input, select, textarea, [tabindex]:not([tabindex="-1"])';

const nameOf = (el: Element) =>
  (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();

const checks: Check[] = [
  {
    name: 'every button and link has a data-testid',
    run: () => {
      const controls = $$(CONTROLS);
      const missing = controls.filter((el) => !el.dataset.testid);
      const label = (el: HTMLElement) => `“${nameOf(el) || el.tagName.toLowerCase()}”`;
      return {
        pass: missing.length === 0,
        detail: missing.length
          ? `missing on: ${missing.map(label).join(', ')}`
          : `${controls.length}/${controls.length} controls`,
      };
    },
  },
  {
    name: 'test ids are unique',
    run: () => {
      const ids = $$('[data-testid]').map((el) => el.dataset.testid);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      return {
        pass: dupes.length === 0,
        detail: dupes.length
          ? `duplicated: ${[...new Set(dupes)].join(', ')}`
          : `${ids.length} ids`,
      };
    },
  },
  {
    name: 'every control has an accessible name',
    run: () => {
      const unnamed = $$(CONTROLS).filter((el) => nameOf(el) === '');
      return {
        pass: unnamed.length === 0,
        detail: unnamed.length
          ? `unnamed: ${unnamed.map((el) => el.dataset.testid ?? el.tagName.toLowerCase()).join(', ')}`
          : '0 unnamed',
      };
    },
  },
  {
    name: '"Skip intro" is the first focusable element',
    run: () => {
      const first = $$(FOCUSABLE)[0];
      return {
        pass: first?.dataset.testid === 'skip-intro',
        detail: `first: ${first?.dataset.testid ?? 'none'}`,
      };
    },
  },
  {
    name: 'one h1, and no skipped heading levels',
    run: () => {
      const levels = $$('h1, h2, h3, h4, h5, h6').map((h) => Number(h.tagName[1]));
      const h1s = levels.filter((l) => l === 1).length;
      const skip = levels.findIndex((l, i) => i > 0 && l > levels[i - 1]! + 1);
      return {
        pass: h1s === 1 && skip === -1,
        detail:
          skip === -1
            ? `${levels.length} headings, ${h1s} h1`
            : `h${levels[skip - 1]} → h${levels[skip]}`,
      };
    },
  },
  {
    name: 'Content Security Policy blocks inline code',
    run: () => {
      const csp =
        document
          .querySelector('meta[http-equiv="content-security-policy" i]')
          ?.getAttribute('content') ?? '';
      return {
        pass: csp.includes("default-src 'self'") && !csp.includes('unsafe-inline'),
        detail: csp ? "no 'unsafe-inline'" : 'no CSP found',
      };
    },
  },
  {
    name: 'no personal contact details on the page',
    run: () => {
      const text = document.documentElement.outerHTML;
      const emails = (text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []).filter(
        (e) => e !== 'hello@example.com',
      );
      // Digits split only by spaces or hyphens: stacked labels ("02↵03↵04") aren't numbers.
      const phones = document.body.innerText.match(/(?:\+44 ?|\b0)\d(?:[ -]?\d){8,10}/g) ?? [];
      return {
        pass: emails.length === 0 && phones.length === 0,
        detail: `${emails.length} emails, ${phones.length} phone numbers`,
      };
    },
  },
  {
    name: 'links that open a new tab are safe',
    run: () => {
      const blank = $$<HTMLAnchorElement>('a[target="_blank"]');
      const unsafe = blank.filter((a) => !/\bnoopener\b/.test(a.rel));
      return { pass: unsafe.length === 0, detail: `${blank.length} checked` };
    },
  },
  {
    name: 'the sound toggle reports its state',
    run: () => {
      const pressed = document
        .querySelector('[data-testid="sound-toggle"]')
        ?.getAttribute('aria-pressed');
      return {
        pass: pressed === 'true' || pressed === 'false',
        detail: `aria-pressed="${pressed ?? ''}"`,
      };
    },
  },
  {
    name: 'every portfolio section is on the page',
    run: () => {
      const sections = $$('[data-lap-section]');
      const titled = sections.filter((s) => s.querySelector('h1, h2'));
      return {
        pass: sections.length > 0 && titled.length === sections.length,
        detail: `${titled.length}/${sections.length} sections`,
      };
    },
  },
];

export function runLiveChecks(): CheckResult[] {
  return checks.map(({ name, run }) => {
    const t0 = performance.now();
    let outcome: { pass: boolean; detail: string };
    try {
      outcome = run();
    } catch (error) {
      outcome = { pass: false, detail: error instanceof Error ? error.message : 'threw' };
    }
    return { name, ...outcome, durationMs: performance.now() - t0 };
  });
}
