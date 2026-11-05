import { execSync } from 'node:child_process';
import { serveDist } from './support/static-server';
import { PORT } from './support/port';

/**
 * Builds the site (locally; CI builds in an earlier step) and serves dist/
 * for the whole run. The returned function is Playwright's global teardown.
 */
export default async function globalSetup() {
  if (!process.env.CI && !process.env.SKIP_BUILD) {
    execSync('npm run build', { stdio: 'inherit' });
  }
  const server = await serveDist(PORT);
  return () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
}
