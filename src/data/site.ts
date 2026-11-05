/**
 * Site-wide details: identity, links and SEO.
 *
 * PRIVACY: this repo is public. Never put a phone number, home address or
 * personal email here. The contact email is a placeholder until Harry swaps it
 * for a public-facing address.
 */
/** The site's path prefix (`base` in astro.config.mjs), always ending in '/'. */
export const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** An internal path under the site's base: withBase('og.png'). */
export const withBase = (path = '') => base + path.replace(/^\//, '');

export const site = {
  name: 'Harry Bevan',
  role: 'Lead Quality AI Engineer',
  /** What the site is, shown in the start-screen title and the page title. */
  product: 'Lead Quality AI Engineer Portfolio',
  url: `https://harrybevan.uk${base}`,
  title: 'Harry Bevan | Lead Quality AI Engineer Portfolio',
  description:
    'Harry Bevan is a Lead Quality AI Engineer in Birmingham, UK: 9+ years in quality engineering, Playwright test automation and AI/LLM validation. Take a lap of the circuit.',
  ogImage: withBase('og.png'),
  ogImageAlt: 'A stylised racing circuit drawn in glowing lines, with the name Harry Bevan.',
  themeColor: '#0a0a0b',
  locale: 'en_GB',
  links: {
    // TODO(Harry): replace with your public contact address.
    email: 'hello@example.com',
    github: 'https://github.com/HarryBevannn',
    /** This site's source code (the repo is public). */
    repo: 'https://github.com/HarryBevannn/HarryBevan-QAPortfolio',
    linkedin: 'https://www.linkedin.com/in/harrybevan97',
  },
} as const;

/** sessionStorage key that remembers the intro was completed this session. */
export const INTRO_STORAGE_KEY = 'hb:intro-complete';
