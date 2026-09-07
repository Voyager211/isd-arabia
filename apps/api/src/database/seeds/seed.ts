import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import mongoose, { Model, Types } from 'mongoose';

import { validateSeedEnv, type SeedEnv } from '@/config/seed-env.schema';
import { loadEnvFile } from '@/config/load-env';
import { AdminUser, AdminUserSchema } from '@/modules/auth/admin-user.schema';
import { Brand, BrandSchema } from '@/modules/brands/brand.schema';
import { Category, CategorySchema } from '@/modules/categories/category.schema';
import { Industry, IndustrySchema } from '@/modules/industries/industry.schema';
import { Product, ProductSchema } from '@/modules/products/product.schema';
import { toSlug } from '@/common/utils/slug.util';
import { generateProducts } from './demo-products.data';
import {
  SEED_BRANDS,
  SEED_CATEGORY_TREE,
  SEED_FLAT_CATEGORIES,
  SEED_INDUSTRIES,
  type SeedCategory,
} from './taxonomy.data';

/**
 * Setup seed (PROJECT_PLAN.md §12.1, §6).
 *
 * Idempotent throughout: every write is an upsert keyed on slug or email, and
 * existing records keep their editable fields. The client owns this data
 * through the admin UI from day one, so a second run must never overwrite what
 * they have changed.
 *
 *   npm run seed                  # everything
 *   npm run seed:admin            # super admin only
 *   npm run seed:taxonomy         # categories, brands, industries only
 */

const DEFAULT_ADMIN = {
  email: 'superadmin@example.com',
  password: '@Password123',
  name: 'Super Admin',
};

type Section = 'admin' | 'taxonomy' | 'demo';

const SECTIONS: Section[] = ['admin', 'taxonomy', 'demo'];

/** Demo products are opt-in — a plain `npm run seed` never creates them. */
const DEFAULT_SECTIONS: Section[] = ['admin', 'taxonomy'];

function parseSections(argv: string[]): Section[] {
  const only = argv.find((arg) => arg.startsWith('--only='))?.split('=')[1];
  if (!only) return DEFAULT_SECTIONS;
  return only.split(',').filter((value): value is Section => SECTIONS.includes(value as Section));
}

function parseCount(argv: string[]): number {
  const raw = argv.find((arg) => arg.startsWith('--count='))?.split('=')[1];
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20_000) : 1500;
}

async function seedAdmin(model: Model<AdminUser>, env: SeedEnv) {
  const isProduction = env.NODE_ENV === 'production';

  /**
   * Guardrail 1 (§12.1): the documented default credential is right for local
   * and staging, and is refused outright in production. `@Password123` on a
   * predictable `superadmin@` address at a public URL is guessable by an
   * automated scanner within minutes.
   *
   * The env schema already rejects a production boot without these set; this
   * is the second line of defence, because the seed can be run as a standalone
   * script that bypasses Nest's bootstrap entirely.
   */
  if (isProduction && (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD)) {
    throw new Error(
      'Refusing to seed the default super admin in production. ' +
        'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.',
    );
  }

  const email = (env.SEED_ADMIN_EMAIL ?? DEFAULT_ADMIN.email).toLowerCase();
  const password = env.SEED_ADMIN_PASSWORD ?? DEFAULT_ADMIN.password;
  const name = env.SEED_ADMIN_NAME ?? DEFAULT_ADMIN.name;

  const existing = await model.findOne({ email }).exec();
  if (existing) {
    console.log(`  · super admin '${email}' already exists — left untouched`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  await model.create({
    name,
    email,
    passwordHash,
    role: 'super_admin',
    isActive: true,
    // Guardrail 2 (§12.1). This flag is what makes shipping a documented
    // default credential safe — the API blocks every other admin route until
    // the password is rotated.
    mustChangePassword: true,
  });

  console.log(`  · created super admin '${email}' (must change password on first sign-in)`);
}

async function upsertCategory(
  model: Model<Category>,
  input: {
    name: string;
    parent: Types.ObjectId | null;
    ancestors: Types.ObjectId[];
    displayOrder: number;
    showInMenu: boolean;
  },
): Promise<Types.ObjectId> {
  const slug = toSlug(input.name);

  const existing = await model.findOne({ slug }).select('_id').lean().exec();
  if (existing) return existing._id;

  const created = await model.create({
    name: input.name,
    slug,
    parent: input.parent,
    ancestors: input.ancestors,
    level: input.ancestors.length,
    displayOrder: input.displayOrder,
    showInMenu: input.showInMenu,
    isActive: true,
  });

  return created._id;
}

async function seedTree(
  model: Model<Category>,
  nodes: SeedCategory[],
  parent: Types.ObjectId | null,
  ancestors: Types.ObjectId[],
): Promise<number> {
  let count = 0;

  for (const [index, node] of nodes.entries()) {
    const id = await upsertCategory(model, {
      name: node.name,
      parent,
      ancestors,
      displayOrder: index,
      showInMenu: node.showInMenu ?? true,
    });
    count += 1;

    if (node.children?.length) {
      count += await seedTree(model, node.children, id, [...ancestors, id]);
    }
  }

  return count;
}

async function seedTaxonomy(
  categoryModel: Model<Category>,
  brandModel: Model<Brand>,
  industryModel: Model<Industry>,
) {
  const treeCount = await seedTree(categoryModel, SEED_CATEGORY_TREE, null, []);
  const flatCount = await seedTree(categoryModel, SEED_FLAT_CATEGORIES, null, []);
  console.log(`  · categories: ${treeCount} in the menu tree, ${flatCount} flat`);

  for (const [index, name] of SEED_BRANDS.entries()) {
    const slug = toSlug(name);
    await brandModel
      .updateOne(
        { slug },
        { $setOnInsert: { name, slug, displayOrder: index, isActive: true } },
        { upsert: true },
      )
      .exec();
  }
  console.log(`  · brands: ${SEED_BRANDS.length}`);

  for (const [index, industry] of SEED_INDUSTRIES.entries()) {
    const slug = toSlug(industry.name);
    await industryModel
      .updateOne(
        { slug },
        {
          $setOnInsert: {
            name: industry.name,
            slug,
            description: industry.description,
            displayOrder: index,
            isActive: true,
          },
        },
        { upsert: true },
      )
      .exec();
  }
  console.log(`  · industries: ${SEED_INDUSTRIES.length}`);
}

/**
 * Generates demo products spread across the leaf categories.
 *
 * Refused in production outright: this is throwaway data for evaluating the
 * UI and for verifying facet performance at catalogue scale, and there is no
 * good reason for it to exist in a live database. Every generated record is
 * tagged so it can be found and removed again.
 */
async function seedDemoProducts(
  productModel: Model<Product>,
  categoryModel: Model<Category>,
  brandModel: Model<Brand>,
  industryModel: Model<Industry>,
  env: SeedEnv,
  count: number,
) {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo products in production.');
  }

  const [categories, brands, industries] = await Promise.all([
    categoryModel.find({ isDeleted: false }).select('_id slug ancestors').lean().exec(),
    brandModel.find({ isDeleted: false }).select('_id').lean().exec(),
    industryModel.find({ isDeleted: false }).select('_id').lean().exec(),
  ]);

  // Products hang off leaves only, so the parents are filtered out here rather
  // than being rejected one at a time by the service.
  const parentIds = new Set(
    categories.flatMap((category) => category.ancestors.map((id) => String(id))),
  );
  const leaves = categories.filter((category) => !parentIds.has(String(category._id)));

  if (!leaves.length) {
    console.log('  · no leaf categories found — run the taxonomy seed first');
    return;
  }

  const perCategory = Math.max(1, Math.ceil(count / leaves.length));
  const documents: Record<string, unknown>[] = [];

  leaves.forEach((category, categoryIndex) => {
    const generated = generateProducts(category.slug, perCategory, categoryIndex + 1);

    generated.forEach((product, index) => {
      const slug = `${toSlug(product.name)}-${product.sku.toLowerCase()}`;

      documents.push({
        ...product,
        slug,
        category: category._id,
        categoryPath: [...category.ancestors, category._id],
        // Spread across brands and industries so the facet counts under test
        // are non-trivial rather than all landing in one bucket.
        brand: brands.length ? brands[(categoryIndex + index) % brands.length]._id : null,
        industries: industries.length
          ? [industries[(categoryIndex + index) % industries.length]._id]
          : [],
        images: [],
        documents: [],
        isActive: true,
        displayOrder: index,
        isDeleted: false,
      });
    });
  });

  const toInsert = documents.slice(0, count);

  // Batched: a single 20,000-document insertMany is a large payload for a
  // free-tier connection and fails as one all-or-nothing operation.
  const BATCH = 500;
  let inserted = 0;

  for (let offset = 0; offset < toInsert.length; offset += BATCH) {
    const batch = toInsert.slice(offset, offset + BATCH);
    // ordered: false so a single duplicate slug from a re-run does not abort
    // the whole batch.
    const result = await productModel
      .insertMany(batch, { ordered: false })
      .catch((error: { insertedDocs?: unknown[] }) => error.insertedDocs ?? []);
    inserted += Array.isArray(result) ? result.length : 0;
  }

  console.log(`  · demo products: ${inserted} inserted across ${leaves.length} categories`);
  // String.raw so the regex prints literally. In a normal string literal the
  // backslashes are swallowed and the command the client pastes into mongosh
  // matches nothing.
  console.log(
    String.raw`  · remove them again with: db.products.deleteMany({ sku: /^[A-Z]+-\d{3}-\d{4}$/ })`,
  );
}

async function main() {
  // ts-node entry point: nothing has loaded .env for us.
  loadEnvFile();

  const env = validateSeedEnv(process.env);
  const sections = parseSections(process.argv.slice(2));
  const demoCount = parseCount(process.argv.slice(2));

  console.log(`Seeding '${env.MONGODB_DB_NAME}' [${env.NODE_ENV}] — ${sections.join(', ')}`);

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    maxPoolSize: 5,
  });

  try {
    const adminModel = mongoose.model(AdminUser.name, AdminUserSchema);
    const categoryModel = mongoose.model(Category.name, CategorySchema);
    const brandModel = mongoose.model(Brand.name, BrandSchema);
    const industryModel = mongoose.model(Industry.name, IndustrySchema);
    const productModel = mongoose.model(Product.name, ProductSchema);

    if (sections.includes('admin')) {
      console.log('Admin:');
      await seedAdmin(adminModel, env);
    }

    if (sections.includes('taxonomy')) {
      console.log('Taxonomy:');
      await seedTaxonomy(categoryModel, brandModel, industryModel);
    }

    if (sections.includes('demo')) {
      console.log(`Demo products (${demoCount}):`);
      await seedDemoProducts(
        productModel,
        categoryModel,
        brandModel,
        industryModel,
        env,
        demoCount,
      );
    }

    console.log('Seed complete.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: Error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
});
