/**
 * LAP: the portfolio arranged round the circuit, one section per part of the
 * track. The case studies are this site and demos built on it, deliberately
 * not tied to any employer or client (Harry's call); there's no CV here
 * either (no dated roles, skills inventory or education), and no CV download.
 *
 * Each section:
 *   - `id`        anchor + DOM id (keep it URL-friendly)
 *   - `waypoint`  the named point on the track the car reaches as this
 *                 section scrolls into view (see `waypoints` in track.ts;
 *                 use 'finish' for a full lap)
 *   - `sector`    the short track label shown on the section and in the HUDs
 *   - `blocks`    the content, rendered by src/components/LapBlock.astro
 *
 * Order matters: the car drives the sections top to bottom.
 *
 * PRIVACY: public repo. No employer or client work, and no personal details.
 */
import { site, withBase } from './site';

export interface CaseStudy {
  kicker: string;
  title: string;
  problem: string;
  approach: string;
  outcome: string;
  metric?: { value: string; label: string };
  tags: string[];
  /** Optional numbered steps, shown as "How it runs". */
  steps?: { label: string; detail: string }[];
  links?: { label: string; href: string; external?: boolean }[];
}

export type Block =
  | { type: 'text'; body: string }
  | { type: 'cases'; items: CaseStudy[] }
  /**
   * This site's own Playwright results: the JSON the CI run writes into dist/
   * (tests/support/results-reporter.ts), loaded and replayed in the browser,
   * plus live checks the visitor can run (src/scripts/liveChecks.ts).
   */
  | {
      type: 'test-run';
      resultsUrl: string;
      ciUrl: string;
      /** Audits CI doesn't run yet, so these are hand-entered. */
      audits: { label: string; value: string; detail?: string }[];
      auditNote: string;
    }
  /** The AI evals scorecard (recorded answers, scored by evals/ → eval-results.json). */
  | { type: 'ai-evals'; resultsUrl: string }
  /** Requirement → analysis → test cases → coverage (data in ./testDesign.ts). */
  | { type: 'test-design' }
  | { type: 'chips'; label: string; items: string[] }
  | { type: 'quotes'; items: { quote: string; attribution: string }[] }
  /** Chequered-flag banner with the visitor's lap time (set by lap.ts). */
  | { type: 'finish'; label: string }
  | {
      type: 'links';
      items: {
        label: string;
        detail: string;
        href: string;
        icon: 'mail' | 'profile' | 'code';
        external?: boolean;
      }[];
    };

export interface LapSectionData {
  id: string;
  waypoint: string;
  sector: string;
  title: string;
  /** The first section is the hero and gets the page's <h1>. */
  hero?: boolean;
  intro?: string;
  blocks: Block[];
}

export const lap: LapSectionData[] = [
  // a) Start line: hero / intro
  {
    id: 'start',
    waypoint: 'start',
    sector: 'Start line',
    hero: true,
    title: site.name,
    intro:
      'Nine years in quality engineering, from regression testing core banking systems to leading quality for AI products. I’d rather show the work than list it, so this site is built the way I build software: specified, automated and tested on every change. Take a lap: first the site’s own test results and AI evals, then how I design tests and automate the admin.',
    blocks: [
      {
        type: 'chips',
        label: 'Specialisms',
        items: ['Playwright', 'AI/LLM validation', 'Test design', 'CI/CD', 'Risk-based testing'],
      },
    ],
  },

  // b) Opening corners: the site as its own case study, with its live results and AI evals
  {
    id: 'telemetry',
    waypoint: 't1',
    sector: 'Opening corners',
    title: 'A portfolio that tests itself',
    intro:
      'A quality engineer’s portfolio should prove the work, not just describe it. This site is specified, automated and tested on every change, and it publishes the evidence.',
    blocks: [
      {
        type: 'cases',
        items: [
          {
            kicker: 'Build & test · This site',
            title: 'Only a green run can deploy',
            problem:
              'Claims about quality are cheap. The proof is a site that can’t ship broken, and shows you why.',
            approach:
              'A stable data-testid on every control, covered by Playwright end-to-end tests on desktop and mobile Chromium, visual regression screenshots, axe accessibility scans, and CSP and privacy checks. GitHub Actions runs lint, type checks and the full suite on every change.',
            outcome:
              'Each deploy publishes its own test results, below. Replay that run, run live checks in your own browser, or break the page and watch the checks catch it.',
            metric: { value: '100%', label: 'controls with a test id' },
            tags: ['Playwright', 'Visual regression', 'axe', 'GitHub Actions'],
            links: [{ label: 'Source code', href: site.links.repo, external: true }],
          },
        ],
      },
      {
        type: 'test-run',
        resultsUrl: withBase('test-results.json'),
        ciUrl: `${site.links.repo}/actions`,
        auditNote: 'Lighthouse, measured on the production build, 9 Nov 2026.',
        audits: [
          { label: 'Performance', value: '96', detail: 'mobile' },
          { label: 'Accessibility', value: '100', detail: 'Lighthouse' },
          { label: 'Best practices', value: '100', detail: 'Lighthouse' },
          { label: 'SEO', value: '100', detail: 'Lighthouse' },
        ],
      },
      {
        type: 'ai-evals',
        resultsUrl: withBase('eval-results.json'),
      },
    ],
  },

  // c) The esses: test design, from requirement to test cases (a demo on this site)
  {
    id: 'test-design',
    waypoint: 'esses',
    sector: 'The esses',
    title: 'From requirement to test cases',
    intro:
      'How an AI test-design agent works, with a tester reviewing every step, shown on something you’ve just used: this site’s start sequence. The agent turns a requirement into acceptance criteria, maps the states and risks, picks techniques and drafts prioritised test cases. A coverage matrix then proves every criterion is tested, and the gaps it finds become new tests.',
    blocks: [{ type: 'test-design' }],
  },

  // d) Back straight: automation, a Power Automate flow built with AI
  {
    id: 'automation',
    waypoint: 'back-straight',
    sector: 'Back straight',
    title: 'Admin that files itself',
    intro:
      'A Power Automate flow, built with AI, that moves tasks from one system onto the board I actually work from, without copying anything by hand.',
    blocks: [
      {
        type: 'cases',
        items: [
          // TODO: Harry to confirm the flow's details match what he built
          {
            kicker: 'Automation · Power Automate + AI',
            title: 'From inbox to task board, untouched',
            problem:
              'Tasks raised in one system arrived as emails in my inbox, and I copied each one by hand onto the task board I built to plan my work. Slow, easy to miss, and the details drifted.',
            approach:
              'I described the flow in plain English and used AI to draft it in Power Automate, then reviewed and hardened it like any other code: one step at a time, tested with sample emails for every case I could think of.',
            outcome:
              'Every task lands on one board with its details and a link back to where it came from, and the inbox only holds what still needs me.',
            tags: ['Power Automate', 'AI-assisted build', 'Workflow automation', 'Testing'],
            steps: [
              { label: 'Trigger', detail: 'A task notification email arrives in my inbox.' },
              {
                label: 'Filter',
                detail:
                  'Only emails from the source system go further, matched by sender and subject.',
              },
              {
                label: 'Extract',
                detail:
                  'The title, due date, priority and a link to the original task are pulled out.',
              },
              {
                label: 'Check',
                detail:
                  'If a card with that link is already on the board, the flow stops: no duplicates.',
              },
              {
                label: 'Create',
                detail: 'A new card goes onto my task board with the details filled in.',
              },
              { label: 'Tidy', detail: 'The email is filed away.' },
            ],
          },
        ],
      },
    ],
  },

  // e) Chequered flag: contact
  {
    id: 'contact',
    waypoint: 'finish',
    sector: 'Chequered flag',
    title: 'Let’s talk quality',
    intro: 'Lap complete. Talk to me about quality engineering, AI validation or test automation.',
    blocks: [
      { type: 'finish', label: 'Chequered flag!' },
      {
        type: 'links',
        items: [
          {
            label: 'LinkedIn',
            detail: 'Connect with me',
            href: site.links.linkedin,
            icon: 'profile',
            external: true,
          },
        ],
      },
    ],
  },
];
