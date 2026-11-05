import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { criteria, testCases } from '../src/data/testDesign';

// The test design demo claims each test case is automated by named Playwright
// tests. Check those tests really exist, so the claims can't drift.
test.describe('Test design demo', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure data: runs once, on desktop.');

  const specs = ['start-sequence.spec.ts', 'accessibility.spec.ts']
    .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8'))
    .join('\n');

  test('every “Automated by” names a real Playwright test', () => {
    const missing = testCases.flatMap((t) =>
      t.automatedBy
        .map((name) => name.replace(/ \(mobile Chromium\)$/, ''))
        .filter((name) => !specs.includes(`test('${name}'`))
        .map((name) => `${t.id}: ${name}`),
    );
    expect(missing).toEqual([]);
  });

  test('every acceptance criterion is covered, and every test case covers one', () => {
    const ids = criteria.map((c) => c.id);
    for (const id of ids) {
      expect(
        testCases.some((t) => t.covers.includes(id)),
        id,
      ).toBe(true);
    }
    for (const t of testCases) {
      expect(
        t.covers.every((c) => ids.includes(c)),
        t.id,
      ).toBe(true);
      expect(t.automatedBy.length, t.id).toBeGreaterThan(0);
    }
  });
});
