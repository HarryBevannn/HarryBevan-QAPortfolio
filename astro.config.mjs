// @ts-check
import { defineConfig } from 'astro/config';

// Served from the custom domain https://harrybevan.uk (public/CNAME), at the
// root. Internal URLs are still built with withBase() (src/data/site.ts), so a
// sub-path `base` could come back without hunting for hard-coded paths.
export default defineConfig({
  site: 'https://harrybevan.uk',
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
