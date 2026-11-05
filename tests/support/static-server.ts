/**
 * Minimal static server for dist/, run inside Playwright's global setup.
 * Behaves like GitHub Pages for a project repo: serves dist/ under the site's
 * base path (/HarryBevan-QAPortfolio/), maps directories to index.html and
 * falls back to 404.html. Paths outside the base redirect into it, so tests
 * can keep using page.goto('/'). In-process (no child server to kill), so test runs always
 * exit promptly on every OS.
 */
import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../dist/', import.meta.url));

/** Must match `base` in astro.config.mjs. */
export const BASE = '/HarryBevan-QAPortfolio/';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

async function resolveFile(urlPath: string): Promise<string | null> {
  let file = normalize(join(root, decodeURIComponent(urlPath)));
  if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) return null; // no path traversal
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

export function serveDist(port: number): Promise<Server> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!`${url.pathname}/`.startsWith(BASE)) {
      res.writeHead(302, { location: BASE + url.pathname.slice(1) + url.search }).end();
      return;
    }
    const file = await resolveFile(url.pathname.slice(BASE.length - 1));
    const target = file ?? join(root, '404.html');
    try {
      const body = await readFile(target);
      res.writeHead(file ? 200 : 404, {
        'content-type': types[extname(target)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(500).end('dist/ is missing. Run `npm run build` first.');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}
