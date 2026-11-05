/**
 * AI evals scorecard (Telemetry): loads /eval-results.json (recorded answers,
 * scored by `npm run evals`) when the panel nears the viewport, and shows a
 * score per category plus every question, with the assistant's answer and
 * checks.
 *
 * Answers are model output, so they're only ever set as text, never HTML.
 */
import {
  CATEGORY_LABEL,
  scoreByCategory,
  type EvalCase,
  type EvalResultsSummary,
} from '../lib/evalResults';

const ICON: Record<EvalCase['status'], string> = { passed: '✓', failed: '✘', missing: '–' };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function caseRow(c: EvalCase): HTMLDetailsElement {
  const details = el('details');
  details.dataset.status = c.status;
  const summary = el('summary');
  summary.dataset.testid = `eval-case-${c.id}`;
  const icon = el('span', 'evals__icon', ICON[c.status]);
  icon.setAttribute('aria-label', c.status);
  summary.append(
    icon,
    el('span', 'evals__question', c.question),
    el('span', 'evals__category', CATEGORY_LABEL[c.category]),
  );

  const detail = el('div', 'evals__detail');
  detail.append(el('p', 'evals__label', 'Assistant’s answer'));
  detail.append(
    el(
      'p',
      'evals__answer',
      c.status === 'missing' ? 'No answer was recorded, so this isn’t scored.' : c.answer,
    ),
  );
  if (c.checks.length) {
    detail.append(el('p', 'evals__label', 'Checks'));
    const list = el('ul', 'evals__checks');
    for (const check of c.checks) {
      const li = el(
        'li',
        check.pass ? 'is-pass' : 'is-fail',
        `${check.pass ? '✓' : '✘'} ${check.name}`,
      );
      list.append(li);
    }
    detail.append(list);
  }
  details.append(summary, detail);
  return details;
}

export function initAiEvals(root: HTMLElement): void {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const meta = q('[data-evals-meta]');
  const board = q('[data-evals-board]');

  const render = (r: EvalResultsSummary) => {
    if (r.cases.length === 0) {
      if (meta) meta.textContent = 'No eval results in this build.';
      return;
    }
    const when = new Date(`${r.recordedAt}T12:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const scored = r.cases.filter((c) => c.status !== 'missing');
    const passed = scored.filter((c) => c.status === 'passed').length;
    if (meta) {
      meta.textContent = `Recorded run · answered by ${r.answeredBy} · ${when} · scored by the suite`;
      meta.title = r.method;
    }
    q('[data-evals-overall]')!.textContent = `${passed}/${scored.length}`;

    const scores = scoreByCategory(r.cases).filter((s) => s.scored > 0);
    q('[data-evals-scores]')!.replaceChildren(
      ...scores.map((s) => {
        const li = el('li', s.passed < s.scored ? 'is-short' : undefined);
        li.dataset.category = s.category;
        const bar = el('span', 'evals__bar');
        bar.setAttribute('aria-hidden', 'true');
        const fill = el('span');
        fill.style.transform = `scaleX(${s.passed / s.scored})`;
        bar.append(fill);
        li.append(
          el('span', 'evals__name', CATEGORY_LABEL[s.category]),
          el('span', 'evals__score', `${s.passed}/${s.scored}`),
          bar,
        );
        return li;
      }),
    );
    q('[data-evals-cases]')!.replaceChildren(...r.cases.map(caseRow));
    q('[data-evals-count]')!.textContent = String(r.cases.length);
    if (board) board.hidden = false;
  };

  const load = async () => {
    try {
      const res = await fetch(root.dataset.resultsUrl ?? 'eval-results.json', {
        cache: 'no-cache',
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as EvalResultsSummary;
      if (!Array.isArray(data.cases)) throw new Error('bad results');
      render(data);
    } catch {
      if (meta) meta.textContent = 'No eval results in this build. They’re added by the CI run.';
    }
  };

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
