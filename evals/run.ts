/**
 * AI evals: scores the recorded answers in ./answers.json with the suite in
 * ./cases.ts and writes public/eval-results.json, which the Telemetry section
 * shows as a scorecard.
 *
 *   npm run evals
 *
 * The answers were recorded once, during development (Harry's call: no live
 * model calls, API keys or rate limits in CI). The scoring is code, and
 * tests/evals.spec.ts re-scores the answers on every test run, so the
 * published scorecard can't drift from the suite. Re-run this after changing
 * a case or an answer, and commit public/eval-results.json.
 */
import { writeFileSync } from 'node:fs';
import { averageJudgeScore, scoreByCategory } from '../src/lib/evalResults.ts';
import { readAnswers, scoreRecorded } from './score.ts';

const summary = scoreRecorded(readAnswers());
writeFileSync(
  new URL('../public/eval-results.json', import.meta.url),
  `${JSON.stringify(summary, null, 2)}\n`,
);

console.log(`AI evals (recorded ${summary.recordedAt}, answered by ${summary.answeredBy}):`);
for (const s of scoreByCategory(summary.cases)) {
  console.log(`  ${s.category}: ${s.passed}/${s.scored}`);
}
for (const c of summary.cases.filter((x) => x.status !== 'passed')) {
  const why = c.checks.filter((k) => !k.pass).map((k) => k.name);
  console.log(`  ✘ ${c.id}: ${why.join('; ') || 'no recorded answer'}`);
}
console.log(`  LLM judge average: ${averageJudgeScore(summary.cases) ?? 'none'}/100`);
for (const c of summary.cases.filter((x) => x.status !== 'missing' && !x.judge)) {
  console.log(`  ✘ ${c.id}: no judge verdict for this exact answer`);
}
console.log('Wrote public/eval-results.json');
