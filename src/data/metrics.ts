/**
 * Headline numbers, shown in the hero. They're about this site and its
 * demos, which visitors can check for themselves, not any employer's work
 * (Harry's call); there's deliberately no CV on this site.
 */

export interface Metric {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

/** Headline numbers. Shown as plain text in the hero. */
export const metrics: Metric[] = [
  { value: 9, suffix: '+', label: 'years in quality & test engineering' },
  { value: 100, suffix: '+', label: 'automated tests run before every deploy' },
  { value: 100, suffix: '%', label: 'of the start sequence’s criteria traced to tests' },
];
