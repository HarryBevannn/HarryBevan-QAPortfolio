/**
 * Scores the recorded answers (./answers.json) with the suite in ./cases.ts.
 * Shared by `npm run evals` (./run.ts), which publishes the scorecard, and by
 * tests/evals.spec.ts, which re-scores on every test run so the published
 * scorecard can't drift from the suite.
 */
import { readFileSync } from 'node:fs';
import type { EvalCase, EvalResultsSummary } from '../src/lib/evalResults.ts';
import { CASES, redact, score } from './cases.ts';

export interface RecordedAnswers {
  answeredBy: string;
  recordedAt: string;
  method: string;
  answers: Record<string, string>;
}

export function readAnswers(): RecordedAnswers {
  return JSON.parse(
    readFileSync(new URL('answers.json', import.meta.url), 'utf8'),
  ) as RecordedAnswers;
}

/** Score every case against its recorded answer. A missing answer isn't scored. */
export function scoreRecorded(recorded: RecordedAnswers): EvalResultsSummary {
  const cases: EvalCase[] = CASES.map(({ id, category, question, ...c }) => {
    const answer = recorded.answers[id];
    if (answer === undefined) {
      return { id, category, question, answer: '', status: 'missing', checks: [] };
    }
    const checks = score({ id, category, question, ...c }, answer);
    return {
      id,
      category,
      question,
      answer: redact(answer),
      status: checks.every((k) => k.pass) ? 'passed' : 'failed',
      checks,
    };
  });
  const { answeredBy, recordedAt, method } = recorded;
  return { answeredBy, recordedAt, method, cases };
}
