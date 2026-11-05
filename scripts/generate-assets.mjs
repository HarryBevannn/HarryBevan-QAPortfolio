/**
 * Generates static assets that need a raster format, using Playwright's
 * Chromium. Run `npm run generate:assets` after changing the design, then
 * commit the results in public/.
 *
 *   public/og.png               1200x630 social card
 *   public/apple-touch-icon.png 180x180 icon
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const out = (name) => fileURLToPath(new URL(`public/${name}`, root));

// Read the track path from the built page so the OG card always matches the site.
let trackPath = '';
try {
  const html = await readFile(new URL('dist/index.html', root), 'utf8');
  trackPath =
    html
      .match(/data-track-path[^>]*d="([^"]+)"|d="([^"]+)"[^>]*data-track-path/)
      ?.slice(1)
      .find(Boolean) ?? '';
} catch {
  console.warn(
    'dist/index.html not found: run `npm run build` first for the track on the OG image.',
  );
}

const base = `
  * { box-sizing: border-box; margin: 0; }
  body { background: #0a0a0b; color: #f5f6f7; font-family: 'Segoe UI', system-ui, sans-serif; }
  .mono { font-family: Consolas, 'Courier New', monospace; letter-spacing: .14em; text-transform: uppercase; }
`;

const ogHtml = `<!doctype html><html><head><style>${base}
  .card { position: relative; width: 1200px; height: 630px; overflow: hidden; padding: 72px;
    display: flex; flex-direction: column; justify-content: flex-end;
    background: radial-gradient(ellipse at 75% 40%, #1f2125, #0a0a0b 70%); }
  svg { position: absolute; right: -40px; top: 40px; width: 760px; }
  h1 { font-size: 92px; line-height: 1; font-weight: 700; }
  .role { margin-top: 18px; font-size: 38px; color: #ff3b30; font-weight: 600; }
  .mono { margin-bottom: 28px; color: #a7abb2; font-size: 20px; }
  .bar { position: absolute; left: 0; top: 0; height: 8px; width: 100%; background: #e10600; }
</style></head><body><div class="card"><div class="bar"></div>
  <svg viewBox="0 0 1000 680"><g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${trackPath}" stroke="#1f2125" stroke-width="36"/>
    <path d="${trackPath}" stroke="rgba(245,246,247,.3)" stroke-width="25"/>
    <path d="${trackPath}" stroke="#1a1c20" stroke-width="22"/>
    <path d="${trackPath}" stroke="rgba(126,224,255,.35)" stroke-width="9"/>
    <path d="${trackPath}" stroke="#7ee0ff" stroke-width="2.5"/>
  </g></svg>
  <p class="mono">One lap of the circuit</p>
  <h1>Harry Bevan</h1>
  <p class="role">Lead Quality AI Engineer Portfolio</p>
</div></body></html>`;

const iconHtml = `<!doctype html><html><head><style>${base} body{background:transparent}</style></head><body>
  <svg width="180" height="180" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect width="64" height="64" fill="#0a0a0b"/>
    <circle cx="32" cy="32" r="23" fill="none" stroke="#9aa0a8" stroke-width="4"/>
    <circle cx="32" cy="32" r="16" fill="#e10600"/>
    <path d="M32 21v9" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M26 24.5a9.5 9.5 0 1 0 12 0" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  </svg></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(ogHtml);
  await page.screenshot({ path: out('og.png') });

  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(iconHtml);
  await page.screenshot({
    path: out('apple-touch-icon.png'),
    clip: { x: 0, y: 0, width: 180, height: 180 },
  });

  console.log('Wrote public/og.png, public/apple-touch-icon.png');
} finally {
  await browser.close();
}
