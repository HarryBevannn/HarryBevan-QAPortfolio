/**
 * Scores the recorded answers (./answers.json) with the suite in ./cases.ts.
 * Shared by `npm run evals` (./run.ts), which publishes the scorecard, and by
 * tests/evals.spec.ts, which re-scores on every test run so the published
 * scorecard can't drift from the suite.
 */
import { readFileSync } from 'node:fs';
import type { EvalCase, EvalJudgement, EvalResultsSummary } from '../src/lib/evalResults.ts';
import { CASES, redact, score } from './cases.ts';
import { RUBRIC, type RubricKey } from './judge.ts';

export interface RecordedAnswers {
  answeredBy: string;
  recordedAt: string;
  method: string;
  answers: Record<string, string>;
}

export interface Verdict {
  /** The reply these marks are for, so a changed answer can't keep its old marks. */
  answer: string;
  marks: Record<RubricKey, number>;
  reason: string;
}

export interface RecordedJudgements {
  judgedBy: string;
  judgedAt: string;
  method: string;
  verdicts: Record<string, Verdict>;
}

const readJson = <T>(file: string) =>
  JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8')) as T;

export const readAnswers = () => readJson<RecordedAnswers>('answers.json');
export const readJudgements = () => readJson<RecordedJudgements>('judgements.json');

/** Totals a verdict from its marks, refusing any mark the rubric doesn't allow. */
export function toJudgement(id: string, verdict: Verdict): EvalJudgement {
  const parts = RUBRIC.map(({ key, label, max }) => {
    const mark = verdict.marks[key];
    if (!Number.isInteger(mark) || mark < 0 || mark > max) {
      throw new Error(`${id}: ${key} must be a whole number from 0 to ${max}, got ${mark}`);
    }
    return { label, score: mark, max };
  });
  return {
    score: parts.reduce((sum, p) => sum + p.score, 0),
    parts,
    reason: redact(verdict.reason),
  };
}

/**
 * Score every case against its recorded answer. A missing answer isn't scored,
 * and a verdict only counts if it was given for exactly this answer.
 */
export function scoreRecorded(
  recorded: RecordedAnswers,
  judged: RecordedJudgements = readJudgements(),
): EvalResultsSummary {
  const cases: EvalCase[] = CASES.map(({ id, category, question, ...c }) => {
    const answer = recorded.answers[id];
    if (answer === undefined) {
      return { id, category, question, answer: '', status: 'missing', checks: [] };
    }
    const checks = score({ id, category, question, ...c }, answer);
    const verdict = judged.verdicts[id];
    return {
      id,
      category,
      question,
      answer: redact(answer),
      status: checks.every((k) => k.pass) ? 'passed' : 'failed',
      checks,
      ...(verdict?.answer === answer ? { judge: toJudgement(id, verdict) } : {}),
    };
  });
  const { answeredBy, recordedAt, method } = recorded;
  const { judgedBy, judgedAt, method: judgeMethod } = judged;
  return { answeredBy, recordedAt, method, judgedBy, judgedAt, judgeMethod, cases };
}
