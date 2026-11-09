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

/** An LLM judge's marks for one answer, out of 100 (evals/judge.ts). */
export interface EvalJudgement {
  score: number;
  parts: { label: string; score: number; max: number }[];
  reason: string;
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
  judge?: EvalJudgement;
}

export interface EvalResultsSummary {
  /** The model that played the assistant, e.g. "Claude Opus 5.5". */
  answeredBy: string;
  /** When the answers were recorded (YYYY-MM-DD). */
  recordedAt: string;
  /** How the answers were produced, in a sentence or two. */
  method: string;
  /** The model that marked the answers. */
  judgedBy?: string;
  /** When they were marked (YYYY-MM-DD). */
  judgedAt?: string;
  /** How the marks were produced, in a sentence or two. */
  judgeMethod?: string;
  cases: EvalCase[];
}

/** The mean judge score across judged answers, or undefined if none were judged. */
export function averageJudgeScore(cases: EvalCase[]): number | undefined {
  const scores = cases.flatMap((c) => (c.judge ? [c.judge.score] : []));
  if (scores.length === 0) return undefined;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
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
