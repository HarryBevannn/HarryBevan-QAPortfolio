/**
 * TEST DESIGN DEMO: requirement analysis to test cases, shown on this site's
 * own start sequence (the "From requirement to test cases" lap section).
 * It's the workflow an AI test-design agent follows, with a tester reviewing
 * each step, worked through on something visitors can try for themselves.
 *
 * Every test case names the real Playwright test(s) that automate it
 * (tests/start-sequence.spec.ts and tests/accessibility.spec.ts), so the
 * coverage claims are checkable. tests/start-sequence.spec.ts verifies those
 * titles exist, so this can't drift from the suite.
 */

export interface AcceptanceCriterion {
  id: string;
  text: string;
}

export interface TestCaseRow {
  id: string;
  title: string;
  /** Acceptance criteria this case covers. */
  covers: string[];
  technique: string;
  priority: 'P1' | 'P2';
  /** Titles of the Playwright tests that automate it. */
  automatedBy: string[];
}

export const story =
  'As a visitor, I want to start the car myself, so the intro never plays without me and I stay in control of it.';

export const criteria: AcceptanceCriterion[] = [
  {
    id: 'AC1',
    text: 'START only works once the safety guard is lifted, and lowering the guard disarms it.',
  },
  {
    id: 'AC2',
    text: 'Pressing START runs the sequence once: five red lights, all green, then the lap.',
  },
  {
    id: 'AC3',
    text: '“Skip intro” is the first focusable element and goes straight to the content, with focus on the hero.',
  },
  { id: 'AC4', text: 'Everything works with a keyboard alone.' },
  {
    id: 'AC5',
    text: 'With reduced motion, the sequence uses fades only and ends in the same place.',
  },
  { id: 'AC6', text: 'No sound plays before the visitor’s first click, and muting is remembered.' },
  {
    id: 'AC7',
    text: 'A finished intro is remembered for the session, and “Replay start” runs it again.',
  },
];

export const analysis = {
  states: ['intro', 'armed', 'starting', 'track'],
  transitions: [
    'intro → armed (lift the guard)',
    'armed → intro (lower the guard)',
    'armed → starting → track (press START)',
    'any stage → track (Skip intro)',
    'track → intro (Replay start)',
  ],
  risks: [
    'An accidental or repeated start',
    'Keyboard focus lost or trapped',
    'Motion that makes visitors unwell',
    'Audio playing without consent',
    'Content hidden if something fails',
  ],
  techniques: [
    'State transition',
    'Negative testing',
    'Equivalence partitioning (input methods)',
    'Accessibility',
    'Cross-device',
  ],
};

export const testCases: TestCaseRow[] = [
  {
    id: 'TC-01',
    title: 'START is locked until the guard is lifted',
    covers: ['AC1'],
    technique: 'Negative',
    priority: 'P1',
    automatedBy: ['guard then button reaches the track state'],
  },
  {
    id: 'TC-02',
    title: 'Lifting the guard arms START and announces it',
    covers: ['AC1'],
    technique: 'State transition',
    priority: 'P1',
    automatedBy: ['guard then button reaches the track state'],
  },
  {
    id: 'TC-03',
    title: 'Lowering the guard disarms START again',
    covers: ['AC1'],
    technique: 'State transition',
    priority: 'P2',
    automatedBy: ['the guard can be lowered again before starting'],
  },
  {
    id: 'TC-04',
    title: 'START runs five red lights, then green, then the lap',
    covers: ['AC2'],
    technique: 'State transition',
    priority: 'P1',
    automatedBy: ['with sound on (the default), the sequence plays audio without errors'],
  },
  {
    id: 'TC-05',
    title: 'Pressing START again mid-sequence doesn’t restart it',
    covers: ['AC2'],
    technique: 'Negative',
    priority: 'P2',
    automatedBy: ['pressing START again mid-sequence does not restart it'],
  },
  {
    id: 'TC-06',
    title: '“Skip intro” is first in the tab order',
    covers: ['AC3'],
    technique: 'Accessibility',
    priority: 'P1',
    automatedBy: ['initial screen: Skip intro is the first focusable element'],
  },
  {
    id: 'TC-07',
    title: '“Skip intro” lands on the hero, with focus',
    covers: ['AC3'],
    technique: 'State transition',
    priority: 'P1',
    automatedBy: ['Skip intro jumps straight to the track/hero state'],
  },
  {
    id: 'TC-08',
    title: 'Keyboard alone: Tab, Enter and Space complete the start',
    covers: ['AC3', 'AC4'],
    technique: 'Equivalence partitioning',
    priority: 'P1',
    automatedBy: ['keyboard-only flow works end to end'],
  },
  {
    id: 'TC-09',
    title: 'No serious accessibility issues at any stage',
    covers: ['AC3', 'AC4'],
    technique: 'Accessibility',
    priority: 'P1',
    automatedBy: [
      'start screen has no serious or critical violations',
      'armed state has no serious or critical violations',
    ],
  },
  {
    id: 'TC-10',
    title: 'Reduced motion: fades only, same end state, focus on the hero',
    covers: ['AC5'],
    technique: 'Accessibility',
    priority: 'P1',
    automatedBy: [
      'shows the content without the full animation',
      'Skip intro moves focus to the hero, not back onto the skip link',
    ],
  },
  {
    id: 'TC-11',
    title: 'No audio exists before the first click',
    covers: ['AC6'],
    technique: 'Negative',
    priority: 'P1',
    automatedBy: ['no audio is created and no AudioContext exists before any click'],
  },
  {
    id: 'TC-12',
    title: 'Muting is remembered after a reload',
    covers: ['AC6'],
    technique: 'State transition',
    priority: 'P2',
    automatedBy: ['sound is on by default, and muting is remembered'],
  },
  {
    id: 'TC-13',
    title: 'A finished intro is skipped on reload; “Replay start” runs it again',
    covers: ['AC7'],
    technique: 'State transition',
    priority: 'P2',
    automatedBy: ['completed intro is remembered for the session, and can be replayed'],
  },
  {
    id: 'TC-14',
    title: 'The whole start works on a phone-sized screen',
    covers: ['AC1', 'AC2', 'AC3'],
    technique: 'Cross-device',
    priority: 'P2',
    automatedBy: ['guard then button reaches the track state (mobile Chromium)'],
  },
];

/** The acceptance criteria each test case covers, the other way round. */
export const coverage = criteria.map((ac) => ({
  ...ac,
  tests: testCases.filter((t) => t.covers.includes(ac.id)).map((t) => t.id),
}));
