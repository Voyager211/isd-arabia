import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import {
  applyTestEnv,
  listenOnEphemeralPort,
  startTestDatabase,
  stopTestDatabase,
} from './setup-e2e';

/**
 * Auth e2e (PROJECT_PLAN.md §12, acceptance criteria #16, #17, #26, #29).
 *
 * Covers the parts of the auth flow that are easy to get subtly wrong and
 * impossible to eyeball: the forced password change actually blocking other
 * routes, refresh rotation invalidating the old token, and the login error
 * being identical whether or not the account exists.
 */
describe('Admin auth (e2e)', () => {
  let app: NestExpressApplication;
  let adminModel: Model<{
    email: string;
    passwordHash: string;
    name: string;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
  }>;

  /** Incremented per test so each gets a distinct rate-limit bucket. */
  let ipCounter = 0;
  let testIp = '10.0.0.1';

  const SEEDED_EMAIL = 'superadmin@example.com';
  const SEEDED_PASSWORD = '@Password123';
  const NEW_PASSWORD = 'Shorewall!Rigging24';

  beforeAll(async () => {
    const uri = await startTestDatabase();
    applyTestEnv(uri);

    // Imported after the env is applied — the config module validates at
    // module-definition time and would otherwise refuse to load.
    const { AppModule } = await import('@/app.module');
    const { AllExceptionsFilter } = await import('@/common/filters/all-exceptions.filter');
    const { AdminUser } = await import('@/modules/auth/admin-user.schema');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('/api/v1');
    // Matches main.ts. It also lets each test present its own source IP, so
    // the login rate limiter buckets them separately instead of one test
    // exhausting the allowance for the rest of the suite.
    app.set('trust proxy', 1);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();

    // Bind once: supertest would otherwise race to bind per request, which
    // breaks the concurrent tests on CI. See setup-e2e.ts.
    await listenOnEphemeralPort(app.getHttpServer());

    adminModel = moduleRef.get(getModelToken(AdminUser.name));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await stopTestDatabase();
  });

  beforeEach(async () => {
    ipCounter += 1;
    testIp = `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;

    await adminModel.deleteMany({});
    await adminModel.create({
      name: 'Super Admin',
      email: SEEDED_EMAIL,
      passwordHash: await bcrypt.hash(SEEDED_PASSWORD, 10),
      role: 'super_admin',
      isActive: true,
      mustChangePassword: true,
    });
  });

  /**
   * Every request carries the per-test source IP. Without it all tests share
   * one rate-limit bucket and the later ones fail with 429 — which looks like
   * a broken endpoint rather than a working limiter.
   */
  const api = {
    get: (path: string) => request(app.getHttpServer()).get(path).set('X-Forwarded-For', testIp),
    post: (path: string) => request(app.getHttpServer()).post(path).set('X-Forwarded-For', testIp),
  };

  const login = (email = SEEDED_EMAIL, password = SEEDED_PASSWORD) =>
    api.post('/api/v1/admin/auth/login').send({ email, password });

  function cookiesFrom(response: request.Response): string[] {
    const raw = response.headers['set-cookie'];
    return Array.isArray(raw) ? raw : raw ? [raw] : [];
  }

  describe('login', () => {
    it('signs in with the seeded credential and sets httpOnly cookies', async () => {
      const response = await login().expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(SEEDED_EMAIL);
      expect(response.body.data.mustChangePassword).toBe(true);

      const cookies = cookiesFrom(response);
      expect(cookies.some((cookie) => cookie.startsWith('isd_at='))).toBe(true);
      expect(cookies.some((cookie) => cookie.startsWith('isd_rt='))).toBe(true);
      // XSS must not be able to read them (§12.2).
      expect(cookies.every((cookie) => cookie.includes('HttpOnly'))).toBe(true);
    });

    it('never leaks the password hash', async () => {
      const response = await login().expect(200);
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('gives the same error for a wrong password and an unknown account', async () => {
      // Differing messages here turn the login form into an enumeration
      // oracle (§11.2).
      const wrongPassword = await login(SEEDED_EMAIL, 'NotThePassword1!').expect(401);
      const unknownUser = await login('nobody@example.com', 'NotThePassword1!').expect(401);

      expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
      expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rate limits repeated failed attempts from one IP', async () => {
      // 5 per 15 minutes (§12.2). The seeded credential is a documented
      // default until it is rotated, so this limit is doing real work.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await login(SEEDED_EMAIL, 'NotThePassword1!').expect(401);
      }

      const blocked = await login(SEEDED_EMAIL, 'NotThePassword1!').expect(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
    });

    it('rejects a malformed email before touching the database', async () => {
      const response = await login('not-an-email', 'whatever').expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('route protection', () => {
    it('rejects an unauthenticated admin request with 401', async () => {
      // Acceptance criterion #26.
      await api.get('/api/v1/admin/auth/me').expect(401);
    });

    it('leaves /health public', async () => {
      const response = await api.get('/api/v1/health').expect(200);
      expect(response.body.data.status).toBe('ok');
    });
  });

  describe('forced password change', () => {
    it('blocks other admin routes until the password is rotated', async () => {
      // Acceptance criterion #16 — enforced server-side, not by a client
      // redirect, so the seeded credential cannot be used via the API either.
      const session = cookiesFrom(await login().expect(200));

      await api
        .post('/api/v1/admin/uploads/signature')
        .set('Cookie', session)
        .send({ folder: 'products', resourceType: 'image' })
        .expect(403);

      // /me stays reachable so the admin app can render who is signed in.
      await api.get('/api/v1/admin/auth/me').set('Cookie', session).expect(200);
    });

    it('clears the flag and unblocks the rest of the admin once changed', async () => {
      const session = cookiesFrom(await login().expect(200));

      const changed = await api
        .post('/api/v1/admin/auth/change-password')
        .set('Cookie', session)
        .send({ currentPassword: SEEDED_PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);

      expect(changed.body.data.mustChangePassword).toBe(false);

      const newSession = cookiesFrom(changed);
      await api
        .post('/api/v1/admin/uploads/signature')
        .set('Cookie', newSession)
        .send({ folder: 'products', resourceType: 'image' })
        // 200, not 201 — the handler sets @HttpCode(OK); signing is not a create.
        .expect(200);
    });

    it('refuses the seeded default as the new password', async () => {
      // Guardrail 3 (§12.1): a forced change that accepts the same value back
      // is not a change.
      const session = cookiesFrom(await login().expect(200));

      const response = await api
        .post('/api/v1/admin/auth/change-password')
        .set('Cookie', session)
        .send({ currentPassword: SEEDED_PASSWORD, newPassword: SEEDED_PASSWORD })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('refuses a password that fails the policy', async () => {
      const session = cookiesFrom(await login().expect(200));

      await api
        .post('/api/v1/admin/auth/change-password')
        .set('Cookie', session)
        .send({ currentPassword: SEEDED_PASSWORD, newPassword: 'alllowercase123' })
        .expect(400);
    });

    it('rejects a wrong current password', async () => {
      const session = cookiesFrom(await login().expect(200));

      await api
        .post('/api/v1/admin/auth/change-password')
        .set('Cookie', session)
        .send({ currentPassword: 'NotThePassword1!', newPassword: NEW_PASSWORD })
        .expect(400);
    });
  });

  describe('refresh rotation', () => {
    it('issues a new pair and invalidates the presented token', async () => {
      const session = cookiesFrom(await login().expect(200));

      const refreshed = await api
        .post('/api/v1/admin/auth/refresh')
        .set('Cookie', session)
        .expect(200);

      expect(cookiesFrom(refreshed).some((cookie) => cookie.startsWith('isd_rt='))).toBe(true);

      // Replaying the rotated-out token must fail — otherwise a stolen token
      // stays usable indefinitely.
      await api.post('/api/v1/admin/auth/refresh').set('Cookie', session).expect(401);
    });

    it('rejects a refresh with no cookie', async () => {
      await api.post('/api/v1/admin/auth/refresh').expect(401);
    });
  });

  describe('logout', () => {
    it('clears the cookies and invalidates the refresh token', async () => {
      const session = cookiesFrom(await login().expect(200));

      const response = await api
        .post('/api/v1/admin/auth/logout')
        .set('Cookie', session)
        .expect(200);

      expect(cookiesFrom(response).some((cookie) => cookie.includes('isd_at=;'))).toBe(true);

      await api.post('/api/v1/admin/auth/refresh').set('Cookie', session).expect(401);
    });
  });
});
