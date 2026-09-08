import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Spins up an in-memory MongoDB for the e2e suite.
 *
 * Standalone, not a replica set. `MongoMemoryReplSet` cannot start in this
 * environment — its bundled driver's handshake is rejected by the mongod it
 * downloads ("Missing required sub-document 'driver' in the client metadata
 * document"), while the app's own driver connects to a standalone fine.
 *
 * The consequence to remember: a standalone mongod cannot run transactions,
 * and the catalogue-activation path uses one (PROJECT_PLAN.md §14.1). That
 * test needs either a replica set or a real Atlas staging cluster — do not
 * "fix" it by dropping the transaction, because Atlas M0 is a three-node
 * replica set and the transaction is what stops a window with zero or two
 * active catalogue files.
 */
let mongod: MongoMemoryServer | undefined;

export async function startTestDatabase(): Promise<string> {
  mongod = await MongoMemoryServer.create();
  return mongod.getUri();
}

export async function stopTestDatabase(): Promise<void> {
  await mongod?.stop();
  mongod = undefined;
}

/**
 * A complete, valid environment for the e2e run.
 *
 * The API refuses to boot on a missing variable, so the suite must supply the
 * full contract — which doubles as a check that .env.example has not drifted
 * from the Zod schema.
 */
export function applyTestEnv(mongoUri: string): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    // Never actually listened on — createNestApplication().init() skips
    // listen() — but the schema requires a valid port, correctly.
    PORT: '4001',
    API_PREFIX: '/api/v1',

    MONGODB_URI: mongoUri,
    MONGODB_DB_NAME: 'isd_arabia_test',

    JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-characters-long',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-characters-long',
    JWT_REFRESH_EXPIRY: '7d',
    // The lowest the schema allows — bcrypt at cost 12 makes the suite crawl.
    BCRYPT_ROUNDS: '10',

    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    CLOUDINARY_UPLOAD_FOLDER: 'isd-test',

    STOREFRONT_ORIGIN: 'http://localhost:3000',
    ADMIN_ORIGIN: 'http://localhost:5173',

    STOREFRONT_REVALIDATE_URL: 'http://localhost:3000/api/revalidate',
    REVALIDATE_SECRET: 'test-revalidate-secret',

    SMTP_HOST: 'localhost',
    SMTP_PORT: '587',
    SMTP_USER: 'test',
    SMTP_PASSWORD: 'test',
    MAIL_FROM: 'test@example.com',
    QUOTATION_NOTIFY_TO: 'sales@example.com',
    QUOTATION_NOTIFY_ENABLED: 'false',

    TURNSTILE_SECRET_KEY: 'test-turnstile',
    TURNSTILE_ENABLED: 'false',
  });
}

/**
 * Binds the application's HTTP server once, before any request is made.
 *
 * Supertest calls `server.listen(0)` itself when handed a server that is not
 * yet listening. That is harmless for sequential requests, but a
 * `Promise.all` of N requests becomes N concurrent attempts to bind an
 * ephemeral port on the same server object — which races, and on a constrained
 * CI runner surfaces as `read ECONNRESET`.
 *
 * The failure looks like an application problem under concurrent load and is
 * not: it is the harness fighting itself. Binding up front means every later
 * `request(server)` reuses the one listening socket.
 */
export async function listenOnEphemeralPort(server: import('node:http').Server): Promise<void> {
  if (server.listening) return;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}
