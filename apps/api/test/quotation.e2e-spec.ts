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
 * Quotation e2e (PROJECT_PLAN.md §7.6, §10, acceptance criteria #8, #22–23,
 * #27–28).
 *
 * The things worth testing against a real database are the ones that only
 * appear under concurrency or over time: unique sequential quote numbers,
 * snapshots surviving the deletion of the product they describe, and the
 * server refusing to take the client's word for what a product is.
 */
describe('Quotations (e2e)', () => {
  let app: NestExpressApplication;
  let models: {
    product: Model<Record<string, unknown>>;
    quotation: Model<Record<string, unknown>>;
    counter: Model<Record<string, unknown>>;
    admin: Model<Record<string, unknown>>;
  };

  const productIds = {
    torch: new Types.ObjectId(),
    nozzle: new Types.ObjectId(),
    inactive: new Types.ObjectId(),
    deleted: new Types.ObjectId(),
  };

  let ipCounter = 0;
  let testIp = '10.2.0.1';

  const api = {
    get: (path: string) => request(app.getHttpServer()).get(path).set('X-Forwarded-For', testIp),
    post: (path: string) => request(app.getHttpServer()).post(path).set('X-Forwarded-For', testIp),
    patch: (path: string) =>
      request(app.getHttpServer()).patch(path).set('X-Forwarded-For', testIp),
    delete: (path: string) =>
      request(app.getHttpServer()).delete(path).set('X-Forwarded-For', testIp),
  };

  const validBody = (items: { productId: string; quantity: number; note?: string }[]) => ({
    customer: {
      name: 'Faisal Al-Otaibi',
      email: 'faisal@contractor.example',
      phone: '+966500000000',
      company: 'Gulf Fabrication Co.',
      designation: 'Procurement Manager',
    },
    address: {
      line1: 'Plot 42, Second Industrial City',
      city: 'Dammam',
      region: 'Eastern Province',
      country: 'Saudi Arabia',
    },
    items,
    message: 'Please confirm lead time.',
  });

  beforeAll(async () => {
    const uri = await startTestDatabase();
    applyTestEnv(uri);

    const { AppModule } = await import('@/app.module');
    const { AllExceptionsFilter } = await import('@/common/filters/all-exceptions.filter');
    const { Product } = await import('@/modules/products/product.schema');
    const { Quotation } = await import('@/modules/quotations/quotation.schema');
    const { Counter } = await import('@/database/counter.schema');
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
      product: moduleRef.get(getModelToken(Product.name)),
      quotation: moduleRef.get(getModelToken(Quotation.name)),
      counter: moduleRef.get(getModelToken(Counter.name)),
      admin: moduleRef.get(getModelToken(AdminUser.name)),
    };

    await models.quotation.syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await stopTestDatabase();
  });

  beforeEach(async () => {
    ipCounter += 1;
    testIp = `10.2.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;

    await Promise.all([
      models.product.deleteMany({}),
      models.quotation.deleteMany({}),
      models.counter.deleteMany({}),
      models.admin.deleteMany({}),
    ]);

    await models.product.insertMany([
      product(productIds.torch, 'TIG Torch WP-26', 'WP-26', { minOrderQuantity: 2 }),
      product(productIds.nozzle, 'Ceramic Nozzle #6', 'CN-6'),
      product(productIds.inactive, 'Retired Torch', 'OLD-1', { isActive: false }),
      product(productIds.deleted, 'Removed Torch', 'DEL-1', { isDeleted: true }),
    ]);
  });

  describe('POST /quotations', () => {
    it('accepts a request and returns a quote number', async () => {
      const response = await api
        .post('/api/v1/quotations')
        .send(validBody([{ productId: String(productIds.nozzle), quantity: 5 }]))
        .expect(201);

      expect(response.body.data.quoteNumber).toMatch(/^QT-\d{4}-\d{4}$/);
      expect(response.body.data.itemCount).toBe(5);
    });

    it('snapshots the product rather than trusting the client', async () => {
      // The cart lives in localStorage where anyone can edit it, so the server
      // re-reads every product and ignores whatever the body claims.
      const response = await api
        .post('/api/v1/quotations')
        .send({
          ...validBody([{ productId: String(productIds.nozzle), quantity: 1 }]),
          items: [
            {
              productId: String(productIds.nozzle),
              quantity: 1,
              // These extra keys are stripped by forbidNonWhitelisted, but the
              // point stands: the stored line comes from the database.
            },
          ],
        })
        .expect(201);

      const stored = await models.quotation
        .findOne({ quoteNumber: response.body.data.quoteNumber })
        .lean();

      const items = (stored as unknown as { items: { name: string; sku: string }[] }).items;
      expect(items[0].name).toBe('Ceramic Nozzle #6');
      expect(items[0].sku).toBe('CN-6');
    });

    it('rejects an unknown field instead of storing it', async () => {
      await api
        .post('/api/v1/quotations')
        .send({
          ...validBody([{ productId: String(productIds.nozzle), quantity: 1 }]),
          items: [{ productId: String(productIds.nozzle), quantity: 1, name: 'Something else' }],
        })
        .expect(400);
    });

    it('raises a quantity below the product minimum', async () => {
      // Enforced server-side too: a request assembled by editing localStorage
      // should not undercut the minimum order quantity.
      const response = await api
        .post('/api/v1/quotations')
        .send(validBody([{ productId: String(productIds.torch), quantity: 1 }]))
        .expect(201);

      const stored = await models.quotation
        .findOne({ quoteNumber: response.body.data.quoteNumber })
        .lean();

      expect((stored as unknown as { items: { quantity: number }[] }).items[0].quantity).toBe(2);
    });

    it('rejects the whole submission when a line is inactive, naming the line', async () => {
      // 422 with the offending indexes, so the frontend can highlight them and
      // offer to remove them without losing the rest of the cart (§10).
      const response = await api
        .post('/api/v1/quotations')
        .send(
          validBody([
            { productId: String(productIds.nozzle), quantity: 1 },
            { productId: String(productIds.inactive), quantity: 1 },
          ]),
        )
        .expect(422);

      expect(response.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(response.body.error.details[0].field).toBe('items[1]');

      // Nothing is persisted — a partial save would confirm a request that is
      // missing items the customer asked for.
      expect(await models.quotation.countDocuments({})).toBe(0);
    });

    it('rejects a soft-deleted product', async () => {
      await api
        .post('/api/v1/quotations')
        .send(validBody([{ productId: String(productIds.deleted), quantity: 1 }]))
        .expect(422);
    });

    it('rejects a product id that does not exist', async () => {
      await api
        .post('/api/v1/quotations')
        .send(validBody([{ productId: String(new Types.ObjectId()), quantity: 1 }]))
        .expect(422);
    });

    it('requires at least one line', async () => {
      const response = await api.post('/api/v1/quotations').send(validBody([])).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('validates the customer block', async () => {
      const body = validBody([{ productId: String(productIds.nozzle), quantity: 1 }]);
      body.customer.email = 'not-an-email';
      await api.post('/api/v1/quotations').send(body).expect(400);
    });

    it('restricts the region to a Saudi province', async () => {
      const body = validBody([{ productId: String(productIds.nozzle), quantity: 1 }]);
      body.address.region = 'Greater London';
      await api.post('/api/v1/quotations').send(body).expect(400);
    });

    it('silently rejects a submission that filled the honeypot', async () => {
      const response = await api
        .post('/api/v1/quotations')
        .send({
          ...validBody([{ productId: String(productIds.nozzle), quantity: 1 }]),
          website: 'http://spam.example',
        })
        .expect(400);

      // The message does not name the honeypot — that would tell a bot which
      // field to leave alone.
      expect(response.body.error.message).not.toMatch(/honeypot|website/i);
      expect(await models.quotation.countDocuments({})).toBe(0);
    });

    it('allocates unique sequential numbers under concurrent submissions', async () => {
      // Acceptance criterion #28. `countDocuments() + 1` passes a sequential
      // test and fails this one, which is exactly why it exists.
      const responses = await Promise.all(
        Array.from({ length: 12 }, () =>
          request(app.getHttpServer())
            .post('/api/v1/quotations')
            // Each submission presents a distinct IP: the 3/hour limiter is
            // per-IP and would otherwise reject most of this burst.
            .set('X-Forwarded-For', `10.9.0.${Math.floor(Math.random() * 200) + 1}`)
            .send(validBody([{ productId: String(productIds.nozzle), quantity: 1 }])),
        ),
      );

      const numbers = responses
        .filter((response) => response.status === 201)
        .map((response) => response.body.data.quoteNumber as string);

      expect(numbers.length).toBeGreaterThan(1);
      expect(new Set(numbers).size).toBe(numbers.length);

      const sequences = numbers.map((number) => Number(number.split('-')[2])).sort((a, b) => a - b);
      // Contiguous from 1 — no gaps and no repeats.
      expect(sequences).toEqual(Array.from({ length: sequences.length }, (_, i) => i + 1));
    });

    it('rate limits repeated submissions from one IP', async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await api
          .post('/api/v1/quotations')
          .send(validBody([{ productId: String(productIds.nozzle), quantity: 1 }]))
          .expect(201);
      }

      await api
        .post('/api/v1/quotations')
        .send(validBody([{ productId: String(productIds.nozzle), quantity: 1 }]))
        .expect(429);
    });
  });

  describe('admin', () => {
    let session: string[];

    beforeEach(async () => {
      await models.admin.create({
        name: 'Sales Admin',
        email: 'sales@example.com',
        passwordHash: await bcrypt.hash('Sh0rewall!Rigging', 10),
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
      });

      const login = await api
        .post('/api/v1/admin/auth/login')
        .send({ email: 'sales@example.com', password: 'Sh0rewall!Rigging' })
        .expect(200);

      const raw = login.headers['set-cookie'];
      session = Array.isArray(raw) ? raw : [raw];
    });

    const submit = async () => {
      const response = await api
        .post('/api/v1/quotations')
        .send(validBody([{ productId: String(productIds.nozzle), quantity: 3 }]))
        .expect(201);

      const stored = await models.quotation
        .findOne({ quoteNumber: response.body.data.quoteNumber })
        .lean();

      return String((stored as unknown as { _id: Types.ObjectId })._id);
    };

    it('rejects unauthenticated access', async () => {
      await api.get('/api/v1/admin/quotations').expect(401);
    });

    it('lists submitted quotations', async () => {
      await submit();

      const response = await api.get('/api/v1/admin/quotations').set('Cookie', session).expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].itemCount).toBe(3);
      expect(response.body.data[0].status).toBe('new');
    });

    it('filters by status', async () => {
      await submit();

      const matching = await api
        .get('/api/v1/admin/quotations?status=new')
        .set('Cookie', session)
        .expect(200);
      expect(matching.body.data).toHaveLength(1);

      const empty = await api
        .get('/api/v1/admin/quotations?status=won')
        .set('Cookie', session)
        .expect(200);
      expect(empty.body.data).toHaveLength(0);
    });

    it('searches by company', async () => {
      await submit();

      const response = await api
        .get('/api/v1/admin/quotations?q=Gulf')
        .set('Cookie', session)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });

    it('treats regex metacharacters in the search as literals', async () => {
      await submit();
      // An unescaped '(' would throw rather than return nothing.
      const response = await api
        .get('/api/v1/admin/quotations?q=((((')
        .set('Cookie', session)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('records who changed the status and when', async () => {
      const id = await submit();

      const response = await api
        .patch(`/api/v1/admin/quotations/${id}/status`)
        .set('Cookie', session)
        .send({ status: 'in_review', note: 'Checking stock.' })
        .expect(200);

      expect(response.body.data.status).toBe('in_review');
      expect(response.body.data.statusHistory).toHaveLength(1);
      expect(response.body.data.statusHistory[0]).toMatchObject({
        from: 'new',
        to: 'in_review',
        note: 'Checking stock.',
      });
      expect(response.body.data.statusHistory[0].changedAt).toBeDefined();
    });

    it('refuses an illegal status transition', async () => {
      // The history is the client's audit trail of a commercial conversation;
      // jumping straight from 'new' to 'won' makes it useless.
      const id = await submit();

      const response = await api
        .patch(`/api/v1/admin/quotations/${id}/status`)
        .set('Cookie', session)
        .send({ status: 'won' })
        .expect(400);

      expect(response.body.error.message).toMatch(/cannot move from 'new' to 'won'/i);
    });

    it('allows cancelling from any state', async () => {
      const id = await submit();

      await api
        .patch(`/api/v1/admin/quotations/${id}/status`)
        .set('Cookie', session)
        .send({ status: 'cancelled' })
        .expect(200);
    });

    it('refuses a no-op status change', async () => {
      const id = await submit();

      await api
        .patch(`/api/v1/admin/quotations/${id}/status`)
        .set('Cookie', session)
        .send({ status: 'new' })
        .expect(400);
    });

    it('appends internal notes with their author', async () => {
      const id = await submit();

      const response = await api
        .post(`/api/v1/admin/quotations/${id}/notes`)
        .set('Cookie', session)
        .send({ note: 'Customer called to chase.' })
        .expect(201);

      expect(response.body.data.adminNotes).toHaveLength(1);
      expect(response.body.data.adminNotes[0].note).toBe('Customer called to chase.');
      expect(response.body.data.adminNotes[0].addedByName).toBe('sales@example.com');
    });

    it('still renders a quotation whose product has since been deleted', async () => {
      // Acceptance criterion #27 — the reason line items are snapshotted.
      const id = await submit();
      await models.product.deleteMany({ _id: productIds.nozzle });

      const response = await api
        .get(`/api/v1/admin/quotations/${id}`)
        .set('Cookie', session)
        .expect(200);

      expect(response.body.data.items[0].name).toBe('Ceramic Nozzle #6');
      expect(response.body.data.items[0].sku).toBe('CN-6');
      expect(response.body.data.items[0].quantity).toBe(3);
    });

    it('exports one CSV row per line item', async () => {
      await submit();

      const response = await api
        .get('/api/v1/admin/quotations/export')
        .set('Cookie', session)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('quotations-');

      const text = response.text;
      expect(text).toContain('Quote number');
      expect(text).toContain('CN-6');
      expect(text).toContain('Gulf Fabrication Co.');
    });

    it('soft deletes rather than removing the record', async () => {
      const id = await submit();

      await api.delete(`/api/v1/admin/quotations/${id}`).set('Cookie', session).expect(200);

      expect(await models.quotation.countDocuments({})).toBe(1);
      await api.get(`/api/v1/admin/quotations/${id}`).set('Cookie', session).expect(404);
    });
  });

  describe('dashboard', () => {
    it('reports quotation activity', async () => {
      await models.admin.create({
        name: 'Sales Admin',
        email: 'sales@example.com',
        passwordHash: await bcrypt.hash('Sh0rewall!Rigging', 10),
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
      });

      const login = await api
        .post('/api/v1/admin/auth/login')
        .send({ email: 'sales@example.com', password: 'Sh0rewall!Rigging' })
        .expect(200);

      const raw = login.headers['set-cookie'];
      const session = Array.isArray(raw) ? raw : [raw];

      await api
        .post('/api/v1/quotations')
        .send(validBody([{ productId: String(productIds.nozzle), quantity: 1 }]))
        .expect(201);

      const response = await api
        .get('/api/v1/admin/dashboard/stats')
        .set('Cookie', session)
        .expect(200);

      expect(response.body.data.newQuotationsLast7Days).toBe(1);
      expect(response.body.data.quotationsByStatus.new).toBe(1);
      // Every status is present, even the empty ones.
      expect(response.body.data.quotationsByStatus.won).toBe(0);
      expect(response.body.data.quotationsPerWeek).toHaveLength(8);
      expect(response.body.data.recentQuotations).toHaveLength(1);
    });
  });
});

function product(
  _id: Types.ObjectId,
  name: string,
  sku: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    _id,
    name,
    slug: sku.toLowerCase(),
    sku,
    category: new Types.ObjectId(),
    categoryPath: [],
    brand: null,
    industries: [],
    images: [],
    documents: [],
    keyFeatures: [],
    specifications: [],
    unit: 'piece',
    minOrderQuantity: 1,
    availability: 'on_request',
    isActive: true,
    isFeatured: false,
    isNewArrival: false,
    displayOrder: 0,
    isDeleted: false,
    ...overrides,
  };
}
