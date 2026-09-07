import { execSync } from 'node:child_process';
import { createServer } from 'node:net';

/**
 * Preflight check before `npm run dev` starts anything.
 *
 * All three ports are fixed on purpose, so a collision is fatal rather than
 * something to work around:
 *
 *   • Vite has `strictPort: true` — falling back to 5174 would leave the admin
 *     on an origin the API does not allowlist, so every request would fail
 *     CORS with no obvious cause.
 *   • Next.js does NOT fail on a taken port; it quietly moves to 3001. That is
 *     worse: canonical URLs would still say :3000, CORS would break, and two
 *     dev servers sharing one `.next` directory corrupt it — surfacing as
 *     "Expected clientReferenceManifest to be defined", which names neither
 *     the port nor the cause.
 *
 * Without this, a stale server produces three failures and a SIGTERM cascade
 * that says nothing about what is actually wrong.
 */

const PORTS = [
  { port: 4000, app: 'API' },
  { port: 3000, app: 'storefront' },
  { port: 5173, app: 'admin' },
];

function isFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

/** Best-effort: identifying the holder is a convenience, never a requirement. */
function findHolder(port) {
  try {
    const command =
      process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -ti :${port}`;

    const output = execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();

    if (process.platform === 'win32') {
      const line = output.split('\n').find((entry) => entry.includes('LISTENING'));
      return line ? line.trim().split(/\s+/).pop() : null;
    }

    return output.trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

const taken = [];

for (const entry of PORTS) {
  if (!(await isFree(entry.port))) {
    taken.push({ ...entry, pid: findHolder(entry.port) });
  }
}

if (taken.length === 0) process.exit(0);

console.error('\nCannot start — these ports are already in use:\n');

for (const { port, app, pid } of taken) {
  console.error(`  ${port}  (${app})${pid ? `  held by PID ${pid}` : ''}`);
}

console.error('\nUsually a dev server left running from an earlier session.\n');

if (process.platform === 'win32') {
  console.error('Free them with:');
  for (const { pid } of taken.filter((entry) => entry.pid)) {
    console.error(`  taskkill /F /PID ${pid}`);
  }
  console.error(`\nOr: npx kill-port ${taken.map((entry) => entry.port).join(' ')}`);
} else {
  console.error(`Free them with:\n  npx kill-port ${taken.map((entry) => entry.port).join(' ')}`);
}

console.error(
  '\nThe ports are fixed deliberately: the API allowlists http://localhost:3000\n' +
    'and http://localhost:5173 for CORS, so a fallback port breaks the apps in\n' +
    'ways that are hard to trace back here.\n',
);

process.exit(1);
