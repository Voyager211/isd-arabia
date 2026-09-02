/* eslint-disable no-console */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import mongoose, { Model, Types } from 'mongoose';

import { validateEnv } from '@/config/env.schema';
import { AdminUser, AdminUserSchema } from '@/modules/auth/admin-user.schema';
import { Brand, BrandSchema } from '@/modules/brands/brand.schema';
import { Category, CategorySchema } from '@/modules/categories/category.schema';
import { Industry, IndustrySchema } from '@/modules/industries/industry.schema';
import { toSlug } from '@/common/utils/slug.util';
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

type Section = 'admin' | 'taxonomy';

function parseSections(argv: string[]): Section[] {
  const only = argv.find((arg) => arg.startsWith('--only='))?.split('=')[1];
  if (!only) return ['admin', 'taxonomy'];
  return only.split(',').filter((s): s is Section => s === 'admin' || s === 'taxonomy');
}

async function seedAdmin(model: Model<AdminUser>, env: ReturnType<typeof validateEnv>) {
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
  if (existing) return existing._id as Types.ObjectId;

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

  return created._id as Types.ObjectId;
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

async function main() {
  const env = validateEnv(process.env);
  const sections = parseSections(process.argv.slice(2));

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

    if (sections.includes('admin')) {
      console.log('Admin:');
      await seedAdmin(adminModel, env);
    }

    if (sections.includes('taxonomy')) {
      console.log('Taxonomy:');
      await seedTaxonomy(categoryModel, brandModel, industryModel);
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
