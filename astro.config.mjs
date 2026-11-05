// @ts-check
import { defineConfig } from 'astro/config';

// The repo is HarryBevan-QAPortfolio, so GitHub Pages serves the site from
// https://harrybevannn.github.io/HarryBevan-QAPortfolio/. Every internal URL is
// built from `base` (withBase() in src/data/site.ts). When the custom domain
// goes live, change `site` and remove `base` (see README).
export default defineConfig({
  site: 'https://harrybevannn.github.io',
  base: '/HarryBevan-QAPortfolio',
  output: 'static',
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'auto',
  },
  security: {
    // Astro hashes every script and style it emits and writes a CSP <meta> tag.
    // GitHub Pages can't send response headers, so a meta tag is the only option.
    // Limitations (frame-ancestors, report-uri, etc.) are documented in the README.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "media-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
    },
  },
});
