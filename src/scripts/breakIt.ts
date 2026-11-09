/**
 * "Break it" (Telemetry): plants real bugs in the page the visitor is
 * reading, of the kinds the live checks (./liveChecks.ts) and the Playwright
 * suite guard against. "Run live checks" then catches and names them, and
 * "Fix it" puts everything back exactly as it was.
 *
 * Nothing leaves the browser, and a reload also undoes it.
 */
interface Bug {
  /** What was broken, for the console once it's fixed. */
  label: string;
  undo: () => void;
}

const one = (sel: string) => document.querySelector<HTMLElement>(sel);

const plants: (() => Bug | null)[] = [
  // A control loses its test id: the tests can no longer find it.
  () => {
    const el = one('[data-testid="test-results-json"]');
    if (!el) return null;
    el.removeAttribute('data-testid');
    return {
      label: 'the raw results link lost its data-testid',
      undo: () => el.setAttribute('data-testid', 'test-results-json'),
    };
  },
  // Two controls share a test id: a test could press the wrong one.
  () => {
    const el = one('[data-testid="hero-contact"]');
    if (!el) return null;
    el.dataset.testid = 'hero-scroll-cue';
    return {
      label: '“Get in touch” took the test id of “Scroll to drive”',
      undo: () => (el.dataset.testid = 'hero-contact'),
    };
  },
  // A heading skips two levels: the outline screen readers navigate by breaks.
  () => {
    const h3 = one('#automation h3');
    if (!h3) return null;
    const h5 = document.createElement('h5');
    for (const { name, value } of h3.attributes) h5.setAttribute(name, value);
    h5.append(...h3.childNodes);
    h3.replaceWith(h5);
    return {
      label: 'a case-study title became an h5, skipping a heading level',
      undo: () => {
        h3.append(...h5.childNodes);
        h5.replaceWith(h3);
      },
    };
  },
];

let planted: Bug[] = [];

export const isBroken = () => planted.length > 0;

/** Plant the bugs; returns how many went in. */
export function breakPage(): number {
  if (!isBroken()) planted = plants.map((plant) => plant()).filter((b): b is Bug => !!b);
  return planted.length;
}

/** Undo every bug, newest first; returns what was fixed. */
export function fixPage(): string[] {
  const fixed = planted.map((b) => b.label);
  planted.reverse().forEach((b) => b.undo());
  planted = [];
  return fixed;
}
