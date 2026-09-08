import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import {
  applyTestEnv,
  listenOnEphemeralPort,
  startTestDatabase,
  stopTestDatabase,
} from './setup-e2e';

/**
 * Catalogue e2e (PROJECT_PLAN.md §8.1, acceptance criteria #2, #19, #30).
 *
 * The behaviour worth testing against a real database is the part that unit
 * tests cannot reach: whether `categoryPath` actually returns descendants,
 * whether the `$facet` counts come back correct, and whether the listing query
 * uses an index instead of scanning the collection.
 */
describe('Catalogue (e2e)', () => {
  let app: NestExpressApplication;
  let models: {
    category: Model<Record<string, unknown>>;
    brand: Model<Record<string, unknown>>;
    industry: Model<Record<string, unknown>>;
    product: Model<Record<string, unknown>>;
    admin: Model<Record<string, unknown>>;
  };

  /** Seeded tree: welding > tig > torches, plus a sibling leaf. */
  const ids = {
    welding: new Types.ObjectId(),
    tig: new Types.ObjectId(),
    torches: new Types.ObjectId(),
    nozzles: new Types.ObjectId(),
    tools: new Types.ObjectId(),
    kaspro: new Types.ObjectId(),
    esab: new Types.ObjectId(),
    oilGas: new Types.ObjectId(),
  };

  let ipCounter = 0;
  let testIp = '10.1.0.1';

  const api = {
    get: (path: string) => request(app.getHttpServer()).get(path).set('X-Forwarded-For', testIp),
    post: (path: string) => request(app.getHttpServer()).post(path).set('X-Forwarded-For', testIp),
    patch: (path: string) =>
      request(app.getHttpServer()).patch(path).set('X-Forwarded-For', testIp),
    delete: (path: string) =>
      request(app.getHttpServer()).delete(path).set('X-Forwarded-For', testIp),
  };

  beforeAll(async () => {
    const uri = await startTestDatabase();
    applyTestEnv(uri);

    const { AppModule } = await import('@/app.module');
    const { AllExceptionsFilter } = await import('@/common/filters/all-exceptions.filter');
    const { Category } = await import('@/modules/categories/category.schema');
    const { Brand } = await import('@/modules/brands/brand.schema');
    const { Industry } = await import('@/modules/industries/industry.schema');
    const { Product } = await import('@/modules/products/product.schema');
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

    // Bind once: supertest would otherwise race to bind per request, which
    // breaks the concurrent tests on CI. See setup-e2e.ts.
    await listenOnEphemeralPort(app.getHttpServer());

    models = {
      category: moduleRef.get(getModelToken(Category.name)),
      brand: moduleRef.get(getModelToken(Brand.name)),
      industry: moduleRef.get(getModelToken(Industry.name)),
      product: moduleRef.get(getModelToken(Product.name)),
      admin: moduleRef.get(getModelToken(AdminUser.name)),
    };

    // The listing query is only index-backed if the indexes exist; autoIndex
    // is off in production so the suite creates them explicitly.
    await Promise.all([
      models.product.syncIndexes(),
      models.category.syncIndexes(),
      models.brand.syncIndexes(),
    ]);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await stopTestDatabase();
  });

  beforeEach(async () => {
    ipCounter += 1;
    testIp = `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;

    await Promise.all([
      models.category.deleteMany({}),
      models.brand.deleteMany({}),
      models.industry.deleteMany({}),
      models.product.deleteMany({}),
      models.admin.deleteMany({}),
    ]);

    await models.category.insertMany([
      cat(ids.welding, 'Welding', 'welding', null, [], 0),
      cat(ids.tig, 'TIG Welding', 'tig-welding', ids.welding, [ids.welding], 1),
      cat(ids.torches, 'TIG Torches', 'tig-torches', ids.tig, [ids.welding, ids.tig], 2),
      cat(ids.nozzles, 'Ceramic Nozzles', 'ceramic-nozzles', ids.tig, [ids.welding, ids.tig], 2),
      cat(ids.tools, 'Tools & Equipment', 'tools-equipment', null, [], 0),
    ]);

    await models.brand.insertMany([
      brand(ids.kaspro, 'KASPRO', 'kaspro'),
      brand(ids.esab, 'ESAB', 'esab'),
    ]);

    await models.industry.insertMany([
      {
        _id: ids.oilGas,
        name: 'Oil & Gas',
        slug: 'oil-gas',
        displayOrder: 0,
        isActive: true,
        isDeleted: false,
      },
    ]);

    await models.product.insertMany([
      product(
        'TIG Torch WP-26',
        'tig-torch-wp-26',
        'WP-26',
        ids.torches,
        [ids.welding, ids.tig, ids.torches],
        ids.kaspro,
        [ids.oilGas],
      ),
      product(
        'TIG Torch WP-17',
        'tig-torch-wp-17',
        'WP-17',
        ids.torches,
        [ids.welding, ids.tig, ids.torches],
        ids.esab,
        [],
      ),
      product(
        'Ceramic Nozzle #6',
        'ceramic-nozzle-6',
        'CN-6',
        ids.nozzles,
        [ids.welding, ids.tig, ids.nozzles],
        ids.kaspro,
        [ids.oilGas],
      ),
      // Inactive: must never appear in a public listing.
      {
        ...product(
          'Retired Torch',
          'retired-torch',
          'OLD-1',
          ids.torches,
          [ids.welding, ids.tig, ids.torches],
          ids.kaspro,
          [],
        ),
        isActive: false,
      },
    ]);
  });

  describe('GET /categories', () => {
    it('returns a nested tree', async () => {
      const response = await api.get('/api/v1/categories').expect(200);
      const roots = response.body.data;

      expect(roots).toHaveLength(2);
      const welding = roots.find((node: { slug: string }) => node.slug === 'welding');
      expect(welding.children[0].slug).toBe('tig-welding');
      expect(welding.children[0].children).toHaveLength(2);
    });

    it('returns a flat list with ?flat=true', async () => {
      const response = await api.get('/api/v1/categories?flat=true').expect(200);
      expect(response.body.data).toHaveLength(5);
      expect(response.body.data[0].children).toBeUndefined();
    });

    it('returns the breadcrumb trail root-first for a leaf', async () => {
      const response = await api.get('/api/v1/categories/tig-torches').expect(200);
      expect(response.body.data.breadcrumbs.map((crumb: { slug: string }) => crumb.slug)).toEqual([
        'welding',
        'tig-welding',
      ]);
    });

    it('404s for an unknown slug', async () => {
      await api.get('/api/v1/categories/does-not-exist').expect(404);
    });
  });

  describe('GET /products', () => {
    it('excludes inactive products', async () => {
      const response = await api.get('/api/v1/products').expect(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.map((p: { sku: string }) => p.sku)).not.toContain('OLD-1');
    });

    it('returns descendants when filtering on a parent category', async () => {
      // The categoryPath denormalisation is the whole point: 'welding' is two
      // levels above these products (acceptance criterion #2).
      const response = await api.get('/api/v1/products?category=welding').expect(200);
      expect(response.body.data).toHaveLength(3);
    });

    it('narrows to a single leaf category', async () => {
      const response = await api.get('/api/v1/products?category=ceramic-nozzles').expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].sku).toBe('CN-6');
    });

    it('filters by brand', async () => {
      const response = await api.get('/api/v1/products?brand=kaspro').expect(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('accepts repeated and comma-separated brand parameters alike', async () => {
      const repeated = await api.get('/api/v1/products?brand=kaspro&brand=esab').expect(200);
      const csv = await api.get('/api/v1/products?brand=kaspro,esab').expect(200);
      expect(repeated.body.meta.total).toBe(3);
      expect(csv.body.meta.total).toBe(3);
    });

    it('returns facet counts alongside the results', async () => {
      const response = await api.get('/api/v1/products').expect(200);
      const { facets, total } = response.body.meta;

      expect(total).toBe(3);
      expect(facets.brands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slug: 'kaspro', count: 2 }),
          expect.objectContaining({ slug: 'esab', count: 1 }),
        ]),
      );
      // categoryPath is unwound, so the parent counts everything beneath it.
      expect(facets.categories).toEqual(
        expect.arrayContaining([expect.objectContaining({ slug: 'welding', count: 3 })]),
      );
    });

    it('keeps other brands visible in the facets when one is selected', async () => {
      // Counting against the fully-filtered set would zero every unticked box
      // and make the sidebar unusable after the first click.
      const response = await api.get('/api/v1/products?brand=kaspro').expect(200);
      const esab = response.body.meta.facets.brands.find(
        (bucket: { slug: string }) => bucket.slug === 'esab',
      );
      expect(esab?.count).toBe(1);
    });

    it('paginates', async () => {
      const response = await api.get('/api/v1/products?limit=2&page=2').expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    });

    it('caps the page size', async () => {
      const response = await api.get('/api/v1/products?limit=500').expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('searches by part number', async () => {
      const response = await api.get('/api/v1/products?q=WP-26').expect(200);
      expect(response.body.data[0].sku).toBe('WP-26');
    });

    it('sorts by name', async () => {
      const response = await api.get('/api/v1/products?sort=name_asc').expect(200);
      const names = response.body.data.map((p: { name: string }) => p.name);
      expect(names).toEqual([...names].sort());
    });

    it('404s when every requested category slug is unknown', async () => {
      await api.get('/api/v1/products?category=not-a-category').expect(404);
    });

    it('never exposes a price field', async () => {
      // The site's entire premise is "price on request" (CLAUDE.md §1).
      const response = await api.get('/api/v1/products').expect(200);
      expect(JSON.stringify(response.body)).not.toMatch(/"price"/i);
    });
  });

  describe('GET /products/:slug', () => {
    it('returns the product with its full category trail', async () => {
      const response = await api.get('/api/v1/products/tig-torch-wp-26').expect(200);

      expect(response.body.data.sku).toBe('WP-26');
      expect(response.body.data.brand.slug).toBe('kaspro');
      expect(response.body.data.categoryTrail.map((c: { slug: string }) => c.slug)).toEqual([
        'welding',
        'tig-welding',
        'tig-torches',
      ]);
    });

    it('404s for an inactive product', async () => {
      await api.get('/api/v1/products/retired-torch').expect(404);
    });

    it('returns related products from the same category, excluding itself', async () => {
      const response = await api.get('/api/v1/products/tig-torch-wp-26/related').expect(200);
      const slugs = response.body.data.map((p: { slug: string }) => p.slug);

      expect(slugs).toContain('tig-torch-wp-17');
      expect(slugs).not.toContain('tig-torch-wp-26');
      expect(slugs).not.toContain('retired-torch');
    });
  });

  describe('GET /search/suggest', () => {
    it('completes a partial part number', async () => {
      // A $text search tokenises on word boundaries and would return nothing
      // for a partial SKU, which is exactly what a typeahead is for.
      const response = await api.get('/api/v1/search/suggest?q=WP-2').expect(200);
      expect(response.body.data.map((s: { sku: string }) => s.sku)).toContain('WP-26');
    });

    it('returns nothing below the two-character minimum', async () => {
      const response = await api.get('/api/v1/search/suggest?q=W').expect(200);
      expect(response.body.data).toEqual([]);
    });

    it('treats regex metacharacters as literals', async () => {
      // An unescaped '(' would make the query throw rather than return empty.
      const response = await api.get('/api/v1/search/suggest?q=((((').expect(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('index coverage', () => {
    it('serves the category listing query from an index', async () => {
      // Acceptance criterion #30. M0 is shared CPU; a COLLSCAN here is the
      // difference between a fast page and a timeout at catalogue scale.
      const explain = await models.product
        .find({ categoryPath: ids.welding, isActive: true, isDeleted: false })
        .explain('queryPlanner');

      const plan = JSON.stringify((explain as { queryPlanner?: unknown }).queryPlanner ?? explain);
      expect(plan).toContain('IXSCAN');
      expect(plan).not.toContain('COLLSCAN');
    });
  });

  describe('admin category writes', () => {
    let session: string[];

    beforeEach(async () => {
      await models.admin.create({
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('Sh0rewall!Rigging', 10),
        role: 'super_admin',
        isActive: true,
        mustChangePassword: false,
      });

      const login = await api
        .post('/api/v1/admin/auth/login')
        .send({ email: 'admin@example.com', password: 'Sh0rewall!Rigging' })
        .expect(200);

      const raw = login.headers['set-cookie'];
      session = Array.isArray(raw) ? raw : [raw];
    });

    it('rejects an unauthenticated write', async () => {
      await api.post('/api/v1/admin/categories').send({ name: 'Nope' }).expect(401);
    });

    it('derives level and ancestors rather than trusting the client', async () => {
      const response = await api
        .post('/api/v1/admin/categories')
        .set('Cookie', session)
        .send({ name: 'MIG Welding', parent: String(ids.welding) })
        .expect(201);

      expect(response.body.data.level).toBe(1);
      expect(response.body.data.ancestors).toEqual([String(ids.welding)]);
      expect(response.body.data.slug).toBe('mig-welding');
    });

    it('rejects a fourth level of nesting', async () => {
      const response = await api
        .post('/api/v1/admin/categories')
        .set('Cookie', session)
        .send({ name: 'Too Deep', parent: String(ids.torches) })
        .expect(400);

      expect(response.body.error.message).toMatch(/3 levels deep at most/i);
    });

    it('de-duplicates a colliding slug', async () => {
      const response = await api
        .post('/api/v1/admin/categories')
        .set('Cookie', session)
        .send({ name: 'Welding' })
        .expect(201);

      expect(response.body.data.slug).toBe('welding-2');
    });

    it('blocks deleting a category that still has children', async () => {
      // Acceptance criterion #19 — the message names the blocker.
      const response = await api
        .delete(`/api/v1/admin/categories/${String(ids.tig)}`)
        .set('Cookie', session)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
      expect(response.body.error.message).toMatch(/subcategor/i);
    });

    it('blocks deleting a category that still has products', async () => {
      const response = await api
        .delete(`/api/v1/admin/categories/${String(ids.nozzles)}`)
        .set('Cookie', session)
        .expect(409);

      expect(response.body.error.message).toMatch(/1 product/);
    });

    it('rejects a move that would create a loop', async () => {
      const response = await api
        .patch(`/api/v1/admin/categories/${String(ids.welding)}`)
        .set('Cookie', session)
        .send({ parent: String(ids.torches) })
        .expect(400);

      expect(response.body.error.message).toMatch(/loop|subcategor/i);
    });

    it('rebuilds descendant ancestors and product paths on a move', async () => {
      // The failure this guards against is silent: without the repair, moving
      // a branch leaves products indexed under their old path and they vanish
      // from the new parent's listing while still looking correct in admin.
      await api
        .patch(`/api/v1/admin/categories/${String(ids.tig)}`)
        .set('Cookie', session)
        .send({ parent: String(ids.tools) })
        .expect(200);

      const torches = await models.category.findById(ids.torches).lean();
      expect((torches as unknown as { ancestors: Types.ObjectId[] }).ancestors.map(String)).toEqual(
        [String(ids.tools), String(ids.tig)],
      );

      const moved = await api.get('/api/v1/products?category=tools-equipment').expect(200);
      expect(moved.body.meta.total).toBe(3);

      const emptied = await api.get('/api/v1/products?category=welding').expect(200);
      expect(emptied.body.meta.total).toBe(0);
    });
  });

  describe('admin product writes', () => {
    let session: string[];

    beforeEach(async () => {
      await models.admin.create({
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('Sh0rewall!Rigging', 10),
        role: 'super_admin',
        isActive: true,
        mustChangePassword: false,
      });

      const login = await api
        .post('/api/v1/admin/auth/login')
        .send({ email: 'admin@example.com', password: 'Sh0rewall!Rigging' })
        .expect(200);

      const raw = login.headers['set-cookie'];
      session = Array.isArray(raw) ? raw : [raw];
    });

    it('computes categoryPath on create', async () => {
      const response = await api
        .post('/api/v1/admin/products')
        .set('Cookie', session)
        .send({ name: 'New Torch', sku: 'NT-1', category: String(ids.torches) })
        .expect(201);

      expect(response.body.data.categoryPath.map(String)).toEqual([
        String(ids.welding),
        String(ids.tig),
        String(ids.torches),
      ]);
    });

    it('refuses a non-leaf category', async () => {
      const response = await api
        .post('/api/v1/admin/products')
        .set('Cookie', session)
        .send({ name: 'Misfiled', sku: 'MF-1', category: String(ids.welding) })
        .expect(400);

      expect(response.body.error.message).toMatch(/no subcategories|leaf/i);
    });

    it('names the conflicting product on a duplicate SKU', async () => {
      const response = await api
        .post('/api/v1/admin/products')
        .set('Cookie', session)
        .send({ name: 'Clone', sku: 'WP-26', category: String(ids.torches) })
        .expect(400);

      expect(response.body.error.message).toContain('TIG Torch WP-26');
    });

    it('strips script tags from the description', async () => {
      const response = await api
        .post('/api/v1/admin/products')
        .set('Cookie', session)
        .send({
          name: 'Sanitised',
          sku: 'SAN-1',
          category: String(ids.torches),
          description: '<p>Safe copy</p><script>alert(1)</script>',
        })
        .expect(201);

      expect(response.body.data.description).toBe('<p>Safe copy</p>');
    });

    it('rejects an unknown field rather than silently storing it', async () => {
      // forbidNonWhitelisted — a client must not be able to smuggle a price
      // field onto a quote-only product.
      await api
        .post('/api/v1/admin/products')
        .set('Cookie', session)
        .send({ name: 'Sneaky', sku: 'SN-1', category: String(ids.torches), price: 100 })
        .expect(400);
    });

    it('recomputes categoryPath when the product changes category', async () => {
      const created = await api
        .post('/api/v1/admin/products')
        .set('Cookie', session)
        .send({ name: 'Movable', sku: 'MV-1', category: String(ids.torches) })
        .expect(201);

      const updated = await api
        .patch(`/api/v1/admin/products/${created.body.data._id}`)
        .set('Cookie', session)
        .send({ category: String(ids.nozzles) })
        .expect(200);

      expect(updated.body.data.categoryPath.map(String)).toEqual([
        String(ids.welding),
        String(ids.tig),
        String(ids.nozzles),
      ]);
    });

    it('soft deletes rather than removing the record', async () => {
      const created = await api
        .post('/api/v1/admin/products')
        .set('Cookie', session)
        .send({ name: 'Temporary', sku: 'TMP-1', category: String(ids.torches) })
        .expect(201);

      await api
        .delete(`/api/v1/admin/products/${created.body.data._id}`)
        .set('Cookie', session)
        .expect(200);

      const stored = await models.product.findById(created.body.data._id).lean();
      expect(stored).not.toBeNull();
      expect((stored as unknown as { isDeleted: boolean }).isDeleted).toBe(true);

      await api.get('/api/v1/products/temporary').expect(404);
    });
  });
});

// ── Fixtures ──────────────────────────────────────────────────────────────

function cat(
  _id: Types.ObjectId,
  name: string,
  slug: string,
  parent: Types.ObjectId | null,
  ancestors: Types.ObjectId[],
  level: number,
) {
  return {
    _id,
    name,
    slug,
    parent,
    ancestors,
    level,
    displayOrder: 0,
    showInMenu: true,
    isActive: true,
    isDeleted: false,
  };
}

function brand(_id: Types.ObjectId, name: string, slug: string) {
  return { _id, name, slug, displayOrder: 0, isActive: true, isDeleted: false };
}

function product(
  name: string,
  slug: string,
  sku: string,
  category: Types.ObjectId,
  categoryPath: Types.ObjectId[],
  brandId: Types.ObjectId | null,
  industries: Types.ObjectId[],
) {
  return {
    name,
    slug,
    sku,
    category,
    categoryPath,
    brand: brandId,
    industries,
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
  };
}
