import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import { applyTestEnv, startTestDatabase, stopTestDatabase } from './setup-e2e';

/**
 * Catalogue download e2e (PROJECT_PLAN.md §7.7–7.8, §9.7, §13.3, acceptance
 * criteria #10, #11, #24, #25).
 *
 * The behaviour that matters here is the gate: the PDF must not be reachable
 * without going through the lead form, and the URL that is handed out must
 * expire. A feature whose whole purpose is lead capture is worthless if the
 * file URL leaks in the metadata response.
 */
describe('Catalogue download (e2e)', () => {
  let app: NestExpressApplication;
  let models: {
    file: Model<Record<string, unknown>>;
    lead: Model<Record<string, unknown>>;
    admin: Model<Record<string, unknown>>;
  };

  let ipCounter = 0;
  let testIp = '10.3.0.1';

  const api = {
    get: (path: string) => request(app.getHttpServer()).get(path).set('X-Forwarded-For', testIp),
    post: (path: string) => request(app.getHttpServer()).post(path).set('X-Forwarded-For', testIp),
    patch: (path: string) =>
      request(app.getHttpServer()).patch(path).set('X-Forwarded-For', testIp),
    delete: (path: string) =>
      request(app.getHttpServer()).delete(path).set('X-Forwarded-For', testIp),
  };

  const leadBody = {
    name: 'Faisal Al-Otaibi',
    email: 'faisal@contractor.example',
    phone: '+966500000000',
    company: 'Gulf Fabrication Co.',
  };

  beforeAll(async () => {
    const uri = await startTestDatabase();
    applyTestEnv(uri);

    const { AppModule } = await import('@/app.module');
    const { AllExceptionsFilter } = await import('@/common/filters/all-exceptions.filter');
    const { CatalogueFile } = await import('@/modules/catalogue/catalogue-file.schema');
    const { CatalogueLead } = await import('@/modules/catalogue/catalogue-lead.schema');
    const { AdminUser } = await import('@/modules/auth/admin-user.schema');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('/api/v1');
    app.set('trust proxy', 1);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();

    models = {
      file: moduleRef.get(getModelToken(CatalogueFile.name)),
      lead: moduleRef.get(getModelToken(CatalogueLead.name)),
      admin: moduleRef.get(getModelToken(AdminUser.name)),
    };
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await stopTestDatabase();
  });

  beforeEach(async () => {
    ipCounter += 1;
    testIp = `10.3.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;

    await Promise.all([
      models.file.deleteMany({}),
      models.lead.deleteMany({}),
      models.admin.deleteMany({}),
    ]);
  });

  const seedFile = async (overrides: Record<string, unknown> = {}) =>
    models.file.create({
      title: '2026 Product Catalogue',
      description: 'The full range.',
      file: {
        url: 'https://res.cloudinary.com/demo/raw/authenticated/catalogue.pdf',
        publicId: 'isd-test/catalogue/catalogue-2026',
        sizeBytes: 8_400_000,
        pageCount: 164,
      },
      version: '2026-Q1',
      requiresLead: true,
      downloadCount: 0,
      isActive: true,
      displayOrder: 0,
      isDeleted: false,
      ...overrides,
    });

  const signIn = async () => {
    await models.admin.create({
      name: 'Marketing Admin',
      email: 'marketing@example.com',
      passwordHash: await bcrypt.hash('Sh0rewall!Rigging', 10),
      role: 'admin',
      isActive: true,
      mustChangePassword: false,
    });

    const login = await api
      .post('/api/v1/admin/auth/login')
      .send({ email: 'marketing@example.com', password: 'Sh0rewall!Rigging' })
      .expect(200);

    const raw = login.headers['set-cookie'];
    return Array.isArray(raw) ? raw : [raw];
  };

  describe('GET /catalogue/active', () => {
    it('returns null when nothing is published', async () => {
      const response = await api.get('/api/v1/catalogue/active').expect(200);
      expect(response.body.data).toBeNull();
    });

    it('returns metadata without the file URL when the download is gated', async () => {
      // Acceptance criterion #11. Returning the URL and trusting the frontend
      // not to render it would make the lead form decorative.
      await seedFile();

      const response = await api.get('/api/v1/catalogue/active').expect(200);

      expect(response.body.data).toMatchObject({
        title: '2026 Product Catalogue',
        version: '2026-Q1',
        sizeBytes: 8_400_000,
        pageCount: 164,
        requiresLead: true,
      });
      expect(response.body.data.downloadUrl).toBeUndefined();
      // Nothing anywhere in the payload points at the asset.
      expect(JSON.stringify(response.body)).not.toContain('catalogue.pdf');
    });

    it('includes a download URL when the gate is off', async () => {
      await seedFile({ requiresLead: false });

      const response = await api.get('/api/v1/catalogue/active').expect(200);
      expect(response.body.data.downloadUrl).toContain('http');
    });

    it('ignores an inactive file', async () => {
      await seedFile({ isActive: false });
      const response = await api.get('/api/v1/catalogue/active').expect(200);
      expect(response.body.data).toBeNull();
    });
  });

  describe('POST /catalogue/download', () => {
    it('captures a lead and returns an expiring URL', async () => {
      // Acceptance criterion #10.
      await seedFile();

      const response = await api.post('/api/v1/catalogue/download').send(leadBody).expect(200);

      expect(response.body.data.downloadUrl).toContain('http');
      expect(new Date(response.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
      // 15 minutes (§13.3) — comfortably under an hour.
      expect(new Date(response.body.data.expiresAt).getTime()).toBeLessThan(
        Date.now() + 60 * 60 * 1000,
      );

      const leads = await models.lead.find({}).lean();
      expect(leads).toHaveLength(1);
      expect(leads[0]).toMatchObject({
        email: 'faisal@contractor.example',
        company: 'Gulf Fabrication Co.',
        catalogueTitle: '2026 Product Catalogue',
      });
    });

    it('increments the download count', async () => {
      const file = await seedFile();

      await api.post('/api/v1/catalogue/download').send(leadBody).expect(200);

      // The increment is fire-and-forget, so allow the write to land.
      await new Promise((resolve) => setTimeout(resolve, 150));

      const updated = await models.file
        .findById((file as unknown as { _id: Types.ObjectId })._id)
        .lean();
      expect((updated as unknown as { downloadCount: number }).downloadCount).toBe(1);
    });

    it('404s when no catalogue is published', async () => {
      await api.post('/api/v1/catalogue/download').send(leadBody).expect(404);
    });

    it('validates the lead form', async () => {
      await seedFile();

      await api
        .post('/api/v1/catalogue/download')
        .send({ ...leadBody, email: 'not-an-email' })
        .expect(400);

      expect(await models.lead.countDocuments({})).toBe(0);
    });

    it('rejects a submission that filled the honeypot', async () => {
      await seedFile();

      await api
        .post('/api/v1/catalogue/download')
        .send({ ...leadBody, website: 'http://spam.example' })
        .expect(400);

      expect(await models.lead.countDocuments({})).toBe(0);
    });

    it('rate limits repeated downloads from one IP', async () => {
      await seedFile();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await api.post('/api/v1/catalogue/download').send(leadBody).expect(200);
      }

      await api.post('/api/v1/catalogue/download').send(leadBody).expect(429);
    });
  });

  describe('admin files', () => {
    it('rejects unauthenticated access', async () => {
      await api.get('/api/v1/admin/catalogue').expect(401);
    });

    it('activates the first uploaded file automatically', async () => {
      // Otherwise an admin uploads a catalogue, sees nothing on the storefront
      // and has to discover the activation toggle to make anything happen.
      const session = await signIn();

      const response = await api
        .post('/api/v1/admin/catalogue')
        .set('Cookie', session)
        .send({
          title: 'First Catalogue',
          version: 'v1',
          file: { url: 'https://example.test/a.pdf', publicId: 'a', sizeBytes: 1000 },
        })
        .expect(201);

      expect(response.body.data.isActive).toBe(true);
    });

    it('leaves a second upload inactive until it is activated', async () => {
      const session = await signIn();
      await seedFile();

      const response = await api
        .post('/api/v1/admin/catalogue')
        .set('Cookie', session)
        .send({
          title: 'Second Catalogue',
          version: 'v2',
          file: { url: 'https://example.test/b.pdf', publicId: 'b', sizeBytes: 2000 },
        })
        .expect(201);

      expect(response.body.data.isActive).toBe(false);
    });

    it('deactivates every other file when one is activated', async () => {
      // Acceptance criterion #24. Exactly one active file, always.
      const session = await signIn();
      const first = await seedFile({ title: 'Old', version: 'v1', isActive: true });
      const second = await seedFile({ title: 'New', version: 'v2', isActive: false });

      const response = await api
        .patch(
          `/api/v1/admin/catalogue/${String((second as unknown as { _id: Types.ObjectId })._id)}/activate`,
        )
        .set('Cookie', session)
        .expect(200);

      expect(response.body.data.isActive).toBe(true);

      const previous = await models.file
        .findById((first as unknown as { _id: Types.ObjectId })._id)
        .lean();
      expect((previous as unknown as { isActive: boolean }).isActive).toBe(false);

      expect(await models.file.countDocuments({ isActive: true })).toBe(1);
    });

    it('serves the newly activated file from the public endpoint', async () => {
      const session = await signIn();
      await seedFile({ title: 'Old', version: 'v1', isActive: true });
      const second = await seedFile({ title: 'New', version: 'v2', isActive: false });

      await api
        .patch(
          `/api/v1/admin/catalogue/${String((second as unknown as { _id: Types.ObjectId })._id)}/activate`,
        )
        .set('Cookie', session)
        .expect(200);

      const active = await api.get('/api/v1/catalogue/active').expect(200);
      expect(active.body.data.title).toBe('New');
    });

    it('soft deletes and clears the active flag', async () => {
      const session = await signIn();
      const file = await seedFile();

      await api
        .delete(
          `/api/v1/admin/catalogue/${String((file as unknown as { _id: Types.ObjectId })._id)}`,
        )
        .set('Cookie', session)
        .expect(200);

      // The record survives; only the storefront stops seeing it.
      expect(await models.file.countDocuments({})).toBe(1);
      const active = await api.get('/api/v1/catalogue/active').expect(200);
      expect(active.body.data).toBeNull();
    });
  });

  describe('admin leads', () => {
    it('lists and searches captured leads', async () => {
      // Acceptance criterion #25.
      const session = await signIn();
      await seedFile();
      await api.post('/api/v1/catalogue/download').send(leadBody).expect(200);

      const all = await api.get('/api/v1/admin/catalogue/leads').set('Cookie', session).expect(200);
      expect(all.body.data).toHaveLength(1);

      const matching = await api
        .get('/api/v1/admin/catalogue/leads?q=Gulf')
        .set('Cookie', session)
        .expect(200);
      expect(matching.body.data).toHaveLength(1);

      const empty = await api
        .get('/api/v1/admin/catalogue/leads?q=Nonexistent')
        .set('Cookie', session)
        .expect(200);
      expect(empty.body.data).toHaveLength(0);
    });

    it('exports leads as CSV', async () => {
      const session = await signIn();
      await seedFile();
      await api.post('/api/v1/catalogue/download').send(leadBody).expect(200);

      const response = await api
        .get('/api/v1/admin/catalogue/leads/export')
        .set('Cookie', session)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('Gulf Fabrication Co.');
      expect(response.text).toContain('2026 Product Catalogue');
    });

    it('reports downloads on the dashboard', async () => {
      const session = await signIn();
      await seedFile();
      await api.post('/api/v1/catalogue/download').send(leadBody).expect(200);

      const response = await api
        .get('/api/v1/admin/dashboard/stats')
        .set('Cookie', session)
        .expect(200);

      expect(response.body.data.catalogueDownloadsLast30Days).toBe(1);
    });
  });
});
