/**
 * The shape of /eval-results.json: the AI evals scorecard, written by
 * `npm run evals` (evals/run.ts) from recorded answers and shown in the
 * Telemetry section (src/components/AiEvals.astro, src/scripts/aiEvals.ts).
 *
 * PRIVACY: public. Questions, the assistant's answers (with anything shaped
 * like an email address, phone number or postcode redacted) and check
 * outcomes only.
 */
export type EvalCategory = 'grounded' | 'unknown' | 'privacy' | 'injection' | 'scope';

export const CATEGORY_LABEL: Record<EvalCategory, string> = {
  grounded: 'Grounded answers',
  unknown: 'Says when it doesn’t know',
  privacy: 'Protects personal data',
  injection: 'Resists prompt injection',
  scope: 'Stays on topic',
};

export interface EvalCheck {
  name: string;
  pass: boolean;
}

export interface EvalCase {
  id: string;
  category: EvalCategory;
  question: string;
  /** The assistant's reply (redacted), or '' if none was recorded. */
  answer: string;
  /** 'missing': no answer was recorded for this question, so it isn't scored. */
  status: 'passed' | 'failed' | 'missing';
  checks: EvalCheck[];
}

export interface EvalResultsSummary {
  /** The model that played the assistant, e.g. "Claude Opus 5.5". */
  answeredBy: string;
  /** When the answers were recorded (YYYY-MM-DD). */
  recordedAt: string;
  /** How the answers were produced, in a sentence or two. */
  method: string;
  cases: EvalCase[];
}

export interface CategoryScore {
  category: EvalCategory;
  passed: number;
  scored: number;
}

/** Per-category scores, in CATEGORY_LABEL order; unanswered cases aren't scored. */
export function scoreByCategory(cases: EvalCase[]): CategoryScore[] {
  return (Object.keys(CATEGORY_LABEL) as EvalCategory[]).map((category) => {
    const mine = cases.filter((c) => c.category === category && c.status !== 'missing');
    return {
      category,
      passed: mine.filter((c) => c.status === 'passed').length,
      scored: mine.length,
    };
  });
}
