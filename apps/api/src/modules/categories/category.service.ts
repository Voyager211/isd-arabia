import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type {
  BreadcrumbCrumb,
  Category as CategoryDto,
  CategoryLevel,
  CategoryNode,
  MenuCategory,
} from '@isd/shared-types';
import { MAX_CATEGORY_DEPTH } from '@isd/shared-types';

import { toSlug } from '@/common/utils/slug.util';
import { notDeleted } from '@/database/schema.helpers';
import { CacheTag, RevalidationService } from '@/modules/revalidation/revalidation.service';
import { Product, ProductDocument } from '@/modules/products/product.schema';
import { Category, CategoryDocument } from './category.schema';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';
import type { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { buildTree, type FlatCategory } from './category-tree.util';

/**
 * Shape of a lean read — the raw document, not the DTO.
 *
 * Derived from the Mongoose class so the ObjectId and Date fields are typed as
 * what the collection actually stores. `toDto` is the single place they become
 * the strings the API returns.
 */
type LeanCategory = Category & { _id: Types.ObjectId };

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly revalidation: RevalidationService,
  ) {}

  // ── Public reads ────────────────────────────────────────────────────────

  /** Full active tree. Used by the storefront filter sidebar and the admin. */
  async getTree(includeInactive = false): Promise<CategoryNode[]> {
    const filter = includeInactive ? notDeleted() : { ...notDeleted(), isActive: true };

    const categories = await this.categoryModel
      .find(filter)
      .sort({ level: 1, displayOrder: 1, name: 1 })
      .lean()
      .exec();

    return buildTree(categories.map(toFlat));
  }

  async getFlat(includeInactive = false): Promise<CategoryDto[]> {
    const filter = includeInactive ? notDeleted() : { ...notDeleted(), isActive: true };

    const categories = await this.categoryModel
      .find(filter)
      .sort({ level: 1, displayOrder: 1, name: 1 })
      .lean()
      .exec();

    return categories.map((category) => this.toDto(category as LeanCategory));
  }

  /**
   * Mega-menu data — only `showInMenu` branches, trimmed to what the panel
   * renders. Fetched on every storefront page, so it stays as small as
   * possible and carries the `categories:menu` cache tag.
   */
  async getMenu(): Promise<MenuCategory[]> {
    const categories = await this.categoryModel
      .find({ ...notDeleted(), isActive: true, showInMenu: true })
      .select('name slug level parent image')
      .sort({ level: 1, displayOrder: 1, name: 1 })
      .lean()
      .exec();

    const tree = buildTree(categories.map(toFlat));

    const toMenu = (node: CategoryNode): MenuCategory => ({
      _id: node._id,
      name: node.name,
      slug: node.slug,
      level: node.level,
      image: node.image ? { url: node.image.url, alt: node.image.alt } : undefined,
      children: node.children.map(toMenu),
    });

    return tree.map(toMenu);
  }

  /** Single category plus the breadcrumb trail its page needs. */
  async findBySlug(
    slug: string,
  ): Promise<{ category: CategoryDto; breadcrumbs: BreadcrumbCrumb[]; descendantIds: string[] }> {
    const category = (await this.categoryModel
      .findOne({ slug: slug.toLowerCase(), ...notDeleted(), isActive: true })
      .lean()
      .exec()) as LeanCategory | null;

    if (!category) {
      throw new NotFoundException(`No category found for '${slug}'.`);
    }

    // One query for the trail rather than one per ancestor.
    const ancestors = category.ancestors.length
      ? await this.categoryModel
          .find({ _id: { $in: category.ancestors } })
          .select('name slug')
          .lean()
          .exec()
      : [];

    // `ancestors` is stored root-first; `$in` does not preserve that order, so
    // the trail is rebuilt from the stored sequence.
    const byId = new Map(ancestors.map((entry) => [String(entry._id), entry]));
    const breadcrumbs: BreadcrumbCrumb[] = category.ancestors
      .map((id) => byId.get(String(id)))
      .filter((entry): entry is (typeof ancestors)[number] => Boolean(entry))
      .map((entry) => ({ name: entry.name, slug: entry.slug }));

    const descendants = await this.categoryModel
      .find({ ancestors: category._id, ...notDeleted() })
      .select('_id')
      .lean()
      .exec();

    return {
      category: this.toDto(category),
      breadcrumbs,
      descendantIds: [String(category._id), ...descendants.map((entry) => String(entry._id))],
    };
  }

  /** Resolves slugs to ids for the product listing filter. */
  async resolveSlugs(slugs: string[]): Promise<Types.ObjectId[]> {
    if (!slugs.length) return [];

    const categories = await this.categoryModel
      .find({ slug: { $in: slugs.map((slug) => slug.toLowerCase()) }, ...notDeleted() })
      .select('_id')
      .lean()
      .exec();

    return categories.map((category) => category._id);
  }

  // ── Admin writes ────────────────────────────────────────────────────────

  async findByIdForAdmin(id: string): Promise<CategoryDto> {
    const category = (await this.categoryModel
      .findOne({ _id: id, ...notDeleted() })
      .lean()
      .exec()) as LeanCategory | null;

    if (!category) throw new NotFoundException('Category not found.');
    return this.toDto(category);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const { parent, ancestors, level } = await this.resolvePlacement(dto.parent ?? null);
    const slug = await this.ensureUniqueSlug(dto.slug ?? dto.name);

    const created = await this.categoryModel.create({
      ...dto,
      slug,
      parent,
      ancestors,
      level,
    });

    this.revalidateFor(slug);
    return this.toDto(created.toObject() as LeanCategory);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const existing = await this.categoryModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!existing) throw new NotFoundException('Category not found.');

    const previousSlug = existing.slug;
    const isMovingParent =
      dto.parent !== undefined && String(dto.parent ?? '') !== String(existing.parent ?? '');

    if (dto.slug && dto.slug !== existing.slug) {
      existing.slug = await this.ensureUniqueSlug(dto.slug, id);
    }

    if (isMovingParent) {
      await this.assertMoveIsLegal(existing, dto.parent ?? null);
      const { parent, ancestors, level } = await this.resolvePlacement(dto.parent ?? null);
      existing.parent = parent;
      existing.ancestors = ancestors;
      existing.level = level;
    }

    for (const key of [
      'name',
      'description',
      'image',
      'banner',
      'displayOrder',
      'showInMenu',
      'isActive',
      'seo',
    ] as const) {
      if (dto[key] !== undefined) {
        // Assigning through the union of field types needs the cast; the keys
        // are a literal tuple, so this stays type-safe at the call site.
        (existing as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }

    await existing.save();

    if (isMovingParent) {
      await this.rebuildSubtree(existing);
    }

    this.revalidateFor(existing.slug, previousSlug);
    return this.toDto(existing.toObject() as LeanCategory);
  }

  /**
   * Soft delete, blocked when the category still holds children or products.
   *
   * Returning 409 with the blocking counts rather than cascading is deliberate
   * (acceptance criterion #19): a cascade here would silently orphan or delete
   * hundreds of hand-entered products.
   */
  async remove(id: string): Promise<{ deleted: true }> {
    const category = await this.categoryModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!category) throw new NotFoundException('Category not found.');

    const [childCount, productCount] = await Promise.all([
      this.categoryModel.countDocuments({ parent: category._id, ...notDeleted() }).exec(),
      this.productModel.countDocuments({ categoryPath: category._id, ...notDeleted() }).exec(),
    ]);

    if (childCount > 0 || productCount > 0) {
      const blockers = [
        childCount > 0 ? `${childCount} subcategor${childCount === 1 ? 'y' : 'ies'}` : null,
        productCount > 0 ? `${productCount} product${productCount === 1 ? '' : 's'}` : null,
      ].filter(Boolean);

      throw new ConflictException({
        code: 'CONFLICT',
        message: `'${category.name}' still contains ${blockers.join(' and ')}. Move or delete them first.`,
        details: [
          { field: 'children', message: String(childCount) },
          { field: 'products', message: String(productCount) },
        ],
      });
    }

    category.isDeleted = true;
    category.deletedAt = new Date();
    await category.save();

    this.revalidateFor(category.slug);
    return { deleted: true };
  }

  async reorder(dto: ReorderCategoriesDto): Promise<{ updated: number }> {
    if (!dto.items.length) return { updated: 0 };

    const result = await this.categoryModel.bulkWrite(
      dto.items.map((item) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(item.id), ...notDeleted() },
          update: { $set: { displayOrder: item.displayOrder } },
        },
      })),
    );

    this.revalidation.revalidate([CacheTag.categoriesMenu, CacheTag.categoriesTree, CacheTag.home]);
    return { updated: result.modifiedCount };
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /** Derives parent, ancestors and level, enforcing the depth cap. */
  private async resolvePlacement(
    parentId: string | null,
  ): Promise<{ parent: Types.ObjectId | null; ancestors: Types.ObjectId[]; level: CategoryLevel }> {
    if (!parentId) return { parent: null, ancestors: [], level: 0 };

    const parent = await this.categoryModel
      .findOne({ _id: parentId, ...notDeleted() })
      .select('_id ancestors level')
      .lean()
      .exec();

    if (!parent) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The selected parent category does not exist.',
        details: [{ field: 'parent', message: 'Unknown category.' }],
      });
    }

    const level = parent.level + 1;
    if (level > MAX_CATEGORY_DEPTH - 1) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Categories can be nested ${MAX_CATEGORY_DEPTH} levels deep at most.`,
        details: [{ field: 'parent', message: 'This would create a fourth level.' }],
      });
    }

    return {
      parent: parent._id,
      ancestors: [...parent.ancestors, parent._id],
      level: level as CategoryLevel,
    };
  }

  /**
   * Rejects a move that would create a cycle or push descendants past the
   * depth cap.
   *
   * The cycle case is the one that matters: re-parenting a category under its
   * own descendant detaches that whole branch from the tree, and because
   * `ancestors` is denormalised the corruption is not obvious until the
   * listing queries start returning nothing.
   */
  private async assertMoveIsLegal(
    category: CategoryDocument,
    newParentId: string | null,
  ): Promise<void> {
    if (!newParentId) return;

    if (String(newParentId) === String(category._id)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A category cannot be its own parent.',
        details: [{ field: 'parent', message: 'Choose a different parent.' }],
      });
    }

    const newParent = await this.categoryModel
      .findOne({ _id: newParentId, ...notDeleted() })
      .select('ancestors level')
      .lean()
      .exec();

    if (!newParent) return; // resolvePlacement raises the clearer error.

    if (newParent.ancestors.some((id) => String(id) === String(category._id))) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A category cannot be moved beneath one of its own subcategories.',
        details: [{ field: 'parent', message: 'That would create a loop.' }],
      });
    }

    // The subtree moves with the category, so the deepest descendant decides
    // whether the move fits inside the depth cap.
    const deepest = await this.categoryModel
      .find({ ancestors: category._id, ...notDeleted() })
      .select('level')
      .sort({ level: -1 })
      .limit(1)
      .lean()
      .exec();

    const subtreeDepth = deepest.length ? deepest[0].level - category.level : 0;
    if (newParent.level + 1 + subtreeDepth > MAX_CATEGORY_DEPTH - 1) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Moving '${category.name}' here would nest its subcategories more than ${MAX_CATEGORY_DEPTH} levels deep.`,
        details: [{ field: 'parent', message: 'The subtree does not fit under this parent.' }],
      });
    }
  }

  /**
   * Rewrites `ancestors` and `level` for every descendant after a move, then
   * repairs the affected products' `categoryPath`.
   *
   * Both halves matter. `categoryPath` is what makes "everything under
   * Welding" one indexed query — leaving it stale after a re-parent silently
   * drops products out of the new parent's listing while the admin UI shows
   * them in the right place (PROJECT_PLAN.md §7.5).
   *
   * One bulkWrite for the categories, one for the products.
   */
  private async rebuildSubtree(root: CategoryDocument): Promise<void> {
    const descendants = await this.categoryModel
      .find({ ancestors: root._id, ...notDeleted() })
      .select('_id parent')
      .lean()
      .exec();

    if (descendants.length) {
      // Walk down from the root so each node's parent is already resolved.
      const childrenByParent = new Map<string, typeof descendants>();
      for (const node of descendants) {
        const key = String(node.parent);
        const bucket = childrenByParent.get(key) ?? [];
        bucket.push(node);
        childrenByParent.set(key, bucket);
      }

      const updates: {
        updateOne: {
          filter: { _id: Types.ObjectId };
          update: { $set: { ancestors: Types.ObjectId[]; level: CategoryLevel } };
        };
      }[] = [];

      const walk = (parentId: Types.ObjectId, ancestors: Types.ObjectId[]) => {
        for (const child of childrenByParent.get(String(parentId)) ?? []) {
          const childAncestors = [...ancestors, parentId];
          updates.push({
            updateOne: {
              filter: { _id: child._id },
              update: {
                $set: {
                  ancestors: childAncestors,
                  // Safe: assertMoveIsLegal has already rejected any move that
                  // would push a descendant past the depth cap.
                  level: childAncestors.length as CategoryLevel,
                },
              },
            },
          });
          walk(child._id, childAncestors);
        }
      };

      walk(root._id, root.ancestors);

      if (updates.length) await this.categoryModel.bulkWrite(updates);
    }

    await this.repairProductPaths([root._id, ...descendants.map((node) => node._id)]);
  }

  /** Recomputes `categoryPath` for every product in the given categories. */
  private async repairProductPaths(categoryIds: Types.ObjectId[]): Promise<void> {
    if (!categoryIds.length) return;

    const categories = await this.categoryModel
      .find({ _id: { $in: categoryIds } })
      .select('_id ancestors')
      .lean()
      .exec();

    const updates = categories.map((category) => ({
      updateMany: {
        filter: { category: category._id },
        update: { $set: { categoryPath: [...category.ancestors, category._id] } },
      },
    }));

    if (updates.length) {
      const result = await this.productModel.bulkWrite(updates);
      this.logger.log(
        `Repaired categoryPath on ${result.modifiedCount} product(s) after a category move.`,
      );
    }
  }

  /**
   * Generates a unique slug, appending `-2`, `-3`, … on collision.
   *
   * Checked here as well as by the unique index so the admin gets a usable
   * suggestion instead of a bare duplicate-key 409.
   */
  private async ensureUniqueSlug(source: string, excludeId?: string): Promise<string> {
    const base = toSlug(source);
    if (!base) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The name must contain at least one letter or number.',
        details: [{ field: 'name', message: 'Cannot generate a URL from this name.' }],
      });
    }

    const taken = await this.categoryModel
      .find({
        slug: new RegExp(`^${base}(-\\d+)?$`),
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      })
      .select('slug')
      .lean()
      .exec();

    const used = new Set(taken.map((entry) => entry.slug));
    if (!used.has(base)) return base;

    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  /**
   * Purges the storefront caches a category write affects.
   *
   * `previousSlug` matters on a rename: the old URL's cached page has to be
   * dropped too, or it keeps serving under a slug that no longer resolves.
   */
  private revalidateFor(slug: string, previousSlug?: string): void {
    const tags = [
      CacheTag.categoriesMenu,
      CacheTag.categoriesTree,
      CacheTag.category(slug),
      CacheTag.productsList,
      CacheTag.home,
    ];

    if (previousSlug && previousSlug !== slug) tags.push(CacheTag.category(previousSlug));
    this.revalidation.revalidate(tags);
  }

  private toDto(category: LeanCategory): CategoryDto {
    return {
      _id: String(category._id),
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      banner: category.banner,
      parent: category.parent ? String(category.parent) : null,
      ancestors: category.ancestors.map(String),
      level: category.level,
      displayOrder: category.displayOrder,
      showInMenu: category.showInMenu,
      isActive: category.isActive,
      seo: category.seo,
      createdAt: new Date(category.createdAt).toISOString(),
      updatedAt: new Date(category.updatedAt).toISOString(),
    };
  }
}

/** Narrows a lean document into the shape the tree builder expects. */
function toFlat(category: {
  _id: Types.ObjectId;
  parent?: Types.ObjectId | null;
  level: number;
  [key: string]: unknown;
}): FlatCategory {
  return {
    ...(category as unknown as FlatCategory),
    _id: String(category._id),
    parent: category.parent ? String(category.parent) : null,
  };
}
