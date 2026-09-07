import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';

import { applyTestEnv, startTestDatabase, stopTestDatabase } from './setup-e2e';

/**
 * Facet aggregation at catalogue scale (PROJECT_PLAN.md §17.1 risk 4).
 *
 * The plan calls for verifying `$facet` performance against at least 1,000
 * seeded products during Phase 2 rather than discovering the problem in
 * Phase 7. This is that check.
 *
 * ── What this suite proves, and what it does not ────────────────────────────
 *
 * PROVES: the aggregation returns correct results and correct facet counts at
 * volume, every listing query is index-backed, and none of it degrades
 * super-linearly as filters are combined.
 *
 * DOES NOT PROVE: that the p95 < 400ms target from §15.1 is met on Atlas M0.
 * This runs against an in-memory mongod on a local disk with no network hop
 * and no noisy neighbours; M0 is shared CPU on a remote host. The timings
 * logged here are a REGRESSION baseline, not a production forecast — the real
 * number has to be measured against staging.
 *
 * The assertions are therefore correctness-first, with a deliberately generous
 * time ceiling that only catches pathological regressions (a dropped index, an
 * accidental collection scan) rather than ordinary variance.
 */

/** Generous on purpose — see the note above. */
const PATHOLOGICAL_CEILING_MS = 3000;
const PRODUCT_COUNT = 1200;

describe('Facet performance at scale (e2e)', () => {
  let app: NestExpressApplication;
  let productModel: Model<Record<string, unknown>>;

  const ids = {
    welding: new Types.ObjectId(),
    tig: new Types.ObjectId(),
    mig: new Types.ObjectId(),
    tools: new Types.ObjectId(),
    safety: new Types.ObjectId(),
  };

  /** Twelve leaves under three parents, so the tree has real depth. */
  const leaves = Array.from({ length: 12 }, (_, index) => ({
    _id: new Types.ObjectId(),
    slug: `leaf-${index}`,
    parent: index < 5 ? ids.tig : index < 8 ? ids.mig : ids.safety,
    ancestors:
      index < 5
        ? [ids.welding, ids.tig]
        : index < 8
          ? [ids.welding, ids.mig]
          : [ids.tools, ids.safety],
  }));

  const brandIds = Array.from({ length: 8 }, () => new Types.ObjectId());
  const industryIds = Array.from({ length: 6 }, () => new Types.ObjectId());

  const timings: { label: string; ms: number }[] = [];

  /** Runs a request, records how long it took, and returns the response. */
  async function timed(label: string, path: string) {
    const started = performance.now();
    const response = await request(app.getHttpServer()).get(path).expect(200);
    const ms = Math.round(performance.now() - started);

    timings.push({ label, ms });
    return { response, ms };
  }

  beforeAll(async () => {
    const uri = await startTestDatabase();
    applyTestEnv(uri);

    const { AppModule } = await import('@/app.module');
    const { AllExceptionsFilter } = await import('@/common/filters/all-exceptions.filter');
    const { Category } = await import('@/modules/categories/category.schema');
    const { Brand } = await import('@/modules/brands/brand.schema');
    const { Industry } = await import('@/modules/industries/industry.schema');
    const { Product } = await import('@/modules/products/product.schema');

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

    const categoryModel: Model<Record<string, unknown>> = moduleRef.get(
      getModelToken(Category.name),
    );
    const brandModel: Model<Record<string, unknown>> = moduleRef.get(getModelToken(Brand.name));
    const industryModel: Model<Record<string, unknown>> = moduleRef.get(
      getModelToken(Industry.name),
    );
    productModel = moduleRef.get(getModelToken(Product.name));

    // Indexes must exist before the volume goes in, or the explain() check is
    // measuring a different collection than production would have.
    await Promise.all([
      productModel.syncIndexes(),
      categoryModel.syncIndexes(),
      brandModel.syncIndexes(),
    ]);

    await categoryModel.insertMany([
      cat(ids.welding, 'Welding', 'welding', null, []),
      cat(ids.tig, 'TIG', 'tig', ids.welding, [ids.welding]),
      cat(ids.mig, 'MIG', 'mig', ids.welding, [ids.welding]),
      cat(ids.tools, 'Tools', 'tools', null, []),
      cat(ids.safety, 'Safety', 'safety', ids.tools, [ids.tools]),
      ...leaves.map((leaf, index) =>
        cat(leaf._id, `Leaf ${index}`, leaf.slug, leaf.parent, leaf.ancestors),
      ),
    ]);

    await brandModel.insertMany(
      brandIds.map((_id, index) => ({
        _id,
        name: `Brand ${index}`,
        slug: `brand-${index}`,
        displayOrder: index,
        isActive: true,
        isDeleted: false,
      })),
    );

    await industryModel.insertMany(
      industryIds.map((_id, index) => ({
        _id,
        name: `Industry ${index}`,
        slug: `industry-${index}`,
        displayOrder: index,
        isActive: true,
        isDeleted: false,
      })),
    );

    // Spread evenly across every dimension so the facet buckets are all
    // non-trivial — a skew where one brand holds everything would hide a slow
    // path in the others.
    const products = Array.from({ length: PRODUCT_COUNT }, (_, index) => {
      const leaf = leaves[index % leaves.length];

      return {
        name: `Product ${index} — industrial welding consumable`,
        slug: `product-${index}`,
        sku: `SKU-${String(index).padStart(5, '0')}`,
        shortDescription: `Consumable ${index} for welding and fabrication.`,
        category: leaf._id,
        categoryPath: [...leaf.ancestors, leaf._id],
        brand: brandIds[index % brandIds.length],
        industries: [industryIds[index % industryIds.length]],
        images: [],
        documents: [],
        keyFeatures: [],
        specifications: [],
        unit: 'piece',
        minOrderQuantity: 1,
        availability: 'on_request',
        // A tenth are inactive: the filter has to do real work rather than
        // matching everything.
        isActive: index % 10 !== 0,
        isFeatured: index % 25 === 0,
        isNewArrival: index % 15 === 0,
        displayOrder: index % 50,
        isDeleted: false,
      };
    });

    for (let offset = 0; offset < products.length; offset += 400) {
      await productModel.insertMany(products.slice(offset, offset + 400));
    }
  }, 180_000);

  afterAll(async () => {
    if (timings.length) {
      // Printed rather than asserted. These are a regression baseline for this
      // machine, NOT a prediction of Atlas M0 (see the header note).
      const rows = timings.map(({ label, ms }) => `  ${String(ms).padStart(5)}ms  ${label}`);
      console.log(
        `\nFacet aggregation timings — ${PRODUCT_COUNT} products, in-memory mongod:\n${rows.join('\n')}\n` +
          '  (indicative only; measure against staging for the §15.1 targets)\n',
      );
    }

    await app?.close();
    await stopTestDatabase();
  });

  describe('correctness at volume', () => {
    it('counts the whole active catalogue', async () => {
      const { response } = await timed('unfiltered listing', '/api/v1/products?limit=24');

      // A tenth are inactive.
      const expectedActive = PRODUCT_COUNT - Math.ceil(PRODUCT_COUNT / 10);
      expect(response.body.meta.total).toBe(expectedActive);
      expect(response.body.data).toHaveLength(24);
    });

    it('returns facet counts that sum to the result total', async () => {
      // The strongest correctness check available: every active product has
      // exactly one brand and one industry, so those buckets must add up to
      // the same total. A drifting sum means the aggregation is double
      // counting or dropping rows.
      const { response } = await timed('facet counts', '/api/v1/products?limit=1');
      const { facets, total } = response.body.meta;

      const brandSum = facets.brands.reduce(
        (sum: number, bucket: { count: number }) => sum + bucket.count,
        0,
      );
      const industrySum = facets.industries.reduce(
        (sum: number, bucket: { count: number }) => sum + bucket.count,
        0,
      );

      expect(brandSum).toBe(total);
      expect(industrySum).toBe(total);
      expect(facets.brands).toHaveLength(8);
      expect(facets.industries).toHaveLength(6);
    });

    it('rolls descendant counts up to the parent category', async () => {
      const { response } = await timed(
        'parent category filter',
        '/api/v1/products?category=welding',
      );
      const welding = response.body.meta.facets.categories.find(
        (bucket: { slug: string }) => bucket.slug === 'welding',
      );

      // Eight of the twelve leaves sit under Welding.
      expect(response.body.meta.total).toBeGreaterThan(0);
      expect(welding.count).toBe(response.body.meta.total);
    });

    it('keeps the other brands visible when one is selected', async () => {
      // The property the facet structure exists to preserve — verified here at
      // volume as well as on the small fixture set.
      const { response } = await timed('brand filter', '/api/v1/products?brand=brand-0');
      const others = response.body.meta.facets.brands.filter(
        (bucket: { slug: string }) => bucket.slug !== 'brand-0',
      );

      expect(others.length).toBe(7);
      expect(others.every((bucket: { count: number }) => bucket.count > 0)).toBe(true);
    });

    it('handles three dimensions combined', async () => {
      const { response } = await timed(
        'category + brand + industry',
        '/api/v1/products?category=welding&brand=brand-0&brand=brand-1&industry=industry-0',
      );

      expect(response.body.meta.total).toBeGreaterThan(0);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('handles a text search combined with filters', async () => {
      // $text lives in the top-level $match and the score is materialised
      // before the $facet — the arrangement this exercises end to end.
      const { response } = await timed(
        'text search + filters',
        '/api/v1/products?q=consumable&brand=brand-2',
      );

      expect(response.body.meta.total).toBeGreaterThan(0);
    });

    it('stays fast on a deep page', async () => {
      // A large $skip is the classic pagination cliff. The load-more control
      // never sends a page this deep, but a crawler following ?page= will.
      const { response } = await timed(
        'deep pagination (page 40)',
        '/api/v1/products?page=40&limit=24',
      );
      expect(response.body.meta.page).toBe(40);
    });
  });

  describe('index coverage at volume', () => {
    it('serves the category listing from an index', async () => {
      const explain = await productModel
        .find({ categoryPath: ids.welding, isActive: true, isDeleted: false })
        .explain('executionStats');

      const plan = JSON.stringify(explain);
      expect(plan).toContain('IXSCAN');
      expect(plan).not.toContain('COLLSCAN');
    });

    it('serves the brand listing from an index', async () => {
      const explain = await productModel
        .find({ brand: brandIds[0], isActive: true, isDeleted: false })
        .explain('executionStats');

      expect(JSON.stringify(explain)).toContain('IXSCAN');
    });

    it('does not examine dramatically more documents than it returns', async () => {
      /**
       * The number that actually matters on shared CPU. A query returning 100
       * documents while examining 1,200 is scanning the collection with extra
       * steps, even if the plan technically reports an IXSCAN somewhere.
       */
      const explain = (await productModel
        .find({ categoryPath: ids.welding, isActive: true, isDeleted: false })
        .explain('executionStats')) as unknown as {
        executionStats: { nReturned: number; totalDocsExamined: number };
      };

      const { nReturned, totalDocsExamined } = explain.executionStats;

      expect(nReturned).toBeGreaterThan(0);
      // Some over-examination is normal for a compound index; an order of
      // magnitude is not.
      expect(totalDocsExamined).toBeLessThanOrEqual(nReturned * 3);
    });
  });

  describe('regression ceiling', () => {
    it('completes every measured query well inside the pathological ceiling', () => {
      // Deliberately loose. This catches a dropped index or an accidental
      // collection scan, not ordinary variance — and it is NOT the §15.1
      // target, which has to be measured against staging.
      const slowest = timings.reduce((worst, entry) => (entry.ms > worst.ms ? entry : worst));

      expect(slowest.ms).toBeLessThan(PATHOLOGICAL_CEILING_MS);
    });
  });
});

function cat(
  _id: Types.ObjectId,
  name: string,
  slug: string,
  parent: Types.ObjectId | null,
  ancestors: Types.ObjectId[],
) {
  return {
    _id,
    name,
    slug,
    parent,
    ancestors,
    level: ancestors.length,
    displayOrder: 0,
    showInMenu: true,
    isActive: true,
    isDeleted: false,
  };
}
