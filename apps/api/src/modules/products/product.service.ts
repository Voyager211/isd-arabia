import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';

import type {
  FacetBucket,
  PaginationMeta,
  ProductCard,
  ProductFacets,
  ProductPopulated,
  SearchSuggestion,
} from '@isd/shared-types';

import { sanitizeRichText } from '@/common/utils/sanitize.util';
import { buildPaginationMeta } from '@/common/utils/pagination.util';
import { notDeleted } from '@/database/schema.helpers';
import { CacheTag, RevalidationService } from '@/modules/revalidation/revalidation.service';
import { CategoryService } from '@/modules/categories/category.service';
import { BrandService } from '@/modules/brands/brand.service';
import { IndustryService } from '@/modules/industries/industry.service';
import { Category, CategoryDocument } from '@/modules/categories/category.schema';
import { CloudinaryService } from '@/modules/uploads/cloudinary.service';
import { Product, ProductDocument } from './product.schema';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { ProductListQueryDto } from './dto/product-list-query.dto';
import {
  buildDimensionFilters,
  buildProductFilter,
  buildProductSort,
  combineFilters,
  normalisePaging,
  toSlugArray,
} from './product-filter.util';

/** The one document a `$facet` stage produces, one key per branch. */
interface FacetResult {
  items: RawCard[];
  total: { value: number }[];
  categoryFacet: RawFacet[];
  brandFacet: RawFacet[];
  industryFacet: RawFacet[];
}

export interface ListResult {
  data: ProductCard[];
  meta: PaginationMeta & { facets: ProductFacets };
}

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    private readonly categories: CategoryService,
    private readonly brands: BrandService,
    private readonly industries: IndustryService,
    private readonly cloudinary: CloudinaryService,
    private readonly revalidation: RevalidationService,
  ) {}

  // ── Public listing ──────────────────────────────────────────────────────

  /**
   * The catalogue listing (PROJECT_PLAN.md §8.1).
   *
   * Results, the total count and the sidebar facet counts all come from ONE
   * `$facet` aggregation. Running them as separate queries would triple the
   * round trips on a shared-CPU M0 for every page of every category.
   *
   * Facet counts are computed against the filter WITHOUT the corresponding
   * dimension applied, so ticking "KASPRO" still shows how many products the
   * other brands have. Counting against the fully-filtered set would zero out
   * every unticked box and make the sidebar unusable after the first click.
   */
  async list(query: ProductListQueryDto): Promise<ListResult> {
    const [categoryIds, brandIds, industryIds] = await Promise.all([
      this.categories.resolveSlugs(toSlugArray(query.category)),
      this.brands.resolveSlugs(toSlugArray(query.brand)),
      this.industries.resolveSlugs(toSlugArray(query.industry)),
    ]);

    if (toSlugArray(query.category).length && !categoryIds.length) {
      // Every requested slug was unknown. An empty `$in` would silently match
      // nothing; a 404 tells the storefront to render its not-found state.
      throw new NotFoundException('No matching category.');
    }

    /**
     * The base filter carries everything that applies to every branch —
     * active, not deleted, the text search, the featured/new flags. The three
     * user-selectable dimensions are deliberately NOT in it.
     */
    const baseFilter = buildProductFilter({
      search: query.q,
      featured: query.featured,
      newArrival: query.newArrival,
    });

    const dimensions = buildDimensionFilters({ categoryIds, brandIds, industryIds });
    const hasText = Boolean(query.q?.trim());
    const { page, limit, skip } = normalisePaging(query.page, query.limit);

    /**
     * Two constraints shape this pipeline, and both are easy to trip over:
     *
     *  1. `$text` is only legal in the FIRST stage of a pipeline and cannot
     *     appear inside `$facet` at all. So the search lives in the top-level
     *     `$match`, and the relevance score is materialised right after it
     *     with `$addFields` — `{ $meta: 'textScore' }` is unreachable from a
     *     facet sub-pipeline.
     *
     *  2. A `$facet` sub-pipeline can only ever NARROW what the top-level
     *     `$match` passed through. Applying all three dimension filters up
     *     front would make every facet count equal the filtered result count,
     *     which is the bug this structure exists to avoid: each branch applies
     *     the OTHER two dimensions, so ticking one brand still shows how many
     *     products the remaining brands have.
     */
    const matchStage = (
      ...parts: (Record<string, unknown> | null)[]
    ): PipelineStage.FacetPipelineStage[] => {
      const filter = combineFilters(...parts);
      return Object.keys(filter).length
        ? ([{ $match: filter }] as PipelineStage.FacetPipelineStage[])
        : [];
    };

    const allDimensions = [dimensions.category, dimensions.brand, dimensions.industry];

    const pipeline: PipelineStage[] = [
      { $match: baseFilter },
      ...(hasText ? ([{ $addFields: { score: { $meta: 'textScore' } } }] as PipelineStage[]) : []),
      {
        $facet: {
          items: [
            ...matchStage(...allDimensions),
            { $sort: buildProductSort(query.sort, hasText) },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                name: 1,
                slug: 1,
                sku: 1,
                shortDescription: 1,
                images: { $slice: ['$images', 1] },
                category: 1,
                brand: 1,
                unit: 1,
                minOrderQuantity: 1,
                availability: 1,
              },
            },
            ...this.cardLookupStages(),
          ] as PipelineStage.FacetPipelineStage[],

          total: [
            ...matchStage(...allDimensions),
            { $count: 'value' },
          ] as PipelineStage.FacetPipelineStage[],

          categoryFacet: this.facetStages(
            matchStage(dimensions.brand, dimensions.industry),
            'categoryPath',
          ),
          brandFacet: this.facetStages(
            matchStage(dimensions.category, dimensions.industry),
            'brand',
          ),
          industryFacet: this.facetStages(
            matchStage(dimensions.category, dimensions.brand),
            'industries',
          ),
        },
      },
    ];

    const [result] = await this.productModel.aggregate<FacetResult>(pipeline).exec();

    const total = result?.total?.[0]?.value ?? 0;
    const items = result?.items ?? [];

    const facets = await this.resolveFacetLabels({
      categories: result?.categoryFacet ?? [],
      brands: result?.brandFacet ?? [],
      industries: result?.industryFacet ?? [],
    });

    return {
      data: items.map(toCard),
      meta: { ...buildPaginationMeta(total, page, limit), facets },
    };
  }

  /** Single product with its references resolved, for the detail page. */
  async findBySlug(slug: string): Promise<ProductPopulated> {
    const product = await this.productModel
      .findOne({ slug: slug.toLowerCase(), ...notDeleted(), isActive: true })
      .populate('category', 'name slug level ancestors')
      .populate('brand', 'name slug logo')
      .populate('industries', 'name slug')
      .lean()
      .exec();

    if (!product) throw new NotFoundException(`No product found for '${slug}'.`);

    const category = product.category as unknown as {
      _id: Types.ObjectId;
      name: string;
      slug: string;
      level: number;
      ancestors: Types.ObjectId[];
    };

    // One query for the full breadcrumb trail rather than one per ancestor.
    const ancestors = category?.ancestors?.length
      ? await this.categoryModel
          .find({ _id: { $in: category.ancestors } })
          .select('name slug')
          .lean()
          .exec()
      : [];

    const byId = new Map(ancestors.map((entry) => [String(entry._id), entry]));
    const categoryTrail = (category?.ancestors ?? [])
      .map((id) => byId.get(String(id)))
      .filter((entry): entry is (typeof ancestors)[number] => Boolean(entry))
      .map((entry) => ({ name: entry.name, slug: entry.slug }));

    if (category) categoryTrail.push({ name: category.name, slug: category.slug });

    const brand = product.brand as unknown as {
      _id: Types.ObjectId;
      name: string;
      slug: string;
      logo?: { url: string; publicId: string; alt: string; order: number };
    } | null;

    return {
      ...(product as unknown as Omit<
        ProductPopulated,
        '_id' | 'category' | 'brand' | 'industries'
      >),
      _id: String(product._id),
      category: {
        _id: String(category?._id ?? ''),
        name: category?.name ?? '',
        slug: category?.slug ?? '',
        level: (category?.level ?? 0) as 0 | 1 | 2,
      },
      categoryTrail,
      brand: brand
        ? { _id: String(brand._id), name: brand.name, slug: brand.slug, logo: brand.logo }
        : null,
      industries: (
        product.industries as unknown as { _id: Types.ObjectId; name: string; slug: string }[]
      ).map((industry) => ({
        _id: String(industry._id),
        name: industry.name,
        slug: industry.slug,
      })),
      categoryPath: (product.categoryPath ?? []).map(String),
      createdAt: new Date(product.createdAt).toISOString(),
      updatedAt: new Date(product.updatedAt).toISOString(),
    };
  }

  /** Eight siblings from the same category, excluding the product itself. */
  async findRelated(slug: string, limit = 8): Promise<ProductCard[]> {
    const product = await this.productModel
      .findOne({ slug: slug.toLowerCase(), ...notDeleted(), isActive: true })
      .select('_id category')
      .lean()
      .exec();

    if (!product) throw new NotFoundException(`No product found for '${slug}'.`);

    const related = await this.productModel
      .aggregate<RawCard>([
        {
          $match: {
            category: product.category,
            _id: { $ne: product._id },
            ...notDeleted(),
            isActive: true,
          },
        },
        { $sort: { displayOrder: 1, createdAt: -1 } },
        { $limit: limit },
        {
          $project: {
            name: 1,
            slug: 1,
            sku: 1,
            shortDescription: 1,
            images: { $slice: ['$images', 1] },
            category: 1,
            brand: 1,
            unit: 1,
            minOrderQuantity: 1,
            availability: 1,
          },
        },
        ...this.cardLookupStages(),
      ])
      .exec();

    return related.map(toCard);
  }

  /** Typeahead — capped at 8, name and SKU only (PROJECT_PLAN.md §9.6). */
  async suggest(term: string, limit = 8): Promise<SearchSuggestion[]> {
    const query = term.trim();
    if (query.length < 2) return [];

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    /**
     * A prefix regex rather than `$text`.
     *
     * Text search tokenises on word boundaries, so "WP-2" matches nothing
     * until the whole token is typed — useless for a typeahead whose main job
     * is completing part numbers. The regex is anchored so it can still use an
     * index, and the result set is capped.
     */
    const results = await this.productModel
      .aggregate<RawCard>([
        {
          $match: {
            ...notDeleted(),
            isActive: true,
            $or: [
              { name: { $regex: escaped, $options: 'i' } },
              { sku: { $regex: `^${escaped}`, $options: 'i' } },
            ],
          },
        },
        { $limit: limit },
        { $project: { name: 1, slug: 1, sku: 1, images: { $slice: ['$images', 1] }, category: 1 } },
        ...this.cardLookupStages(),
      ])
      .exec();

    return results.map((product) => ({
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      imageUrl: product.images?.[0]?.url ?? null,
      categoryName: product.categoryDoc?.name ?? '',
    }));
  }

  /** Every active slug, for `generateStaticParams` and the sitemap. */
  async findAllSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
    const products = await this.productModel
      .find({ ...notDeleted(), isActive: true })
      .select('slug updatedAt')
      .lean()
      .exec();

    return products.map((product) => ({
      slug: product.slug,
      updatedAt: new Date(product.updatedAt).toISOString(),
    }));
  }

  // ── Admin ───────────────────────────────────────────────────────────────

  async listForAdmin(query: ProductListQueryDto): Promise<ListResult> {
    const [categoryIds, brandIds] = await Promise.all([
      this.categories.resolveSlugs(toSlugArray(query.category)),
      this.brands.resolveSlugs(toSlugArray(query.brand)),
    ]);

    const filter = buildProductFilter({
      categoryIds,
      brandIds,
      search: query.q,
      includeInactive: true,
    });

    // The admin list filters on status explicitly rather than inheriting the
    // public "active only" rule.
    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;

    const { page, limit, skip } = normalisePaging(query.page, query.limit);
    const hasText = Boolean(query.q?.trim());

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .select('name slug sku images category brand isActive isFeatured isNewArrival updatedAt')
        .populate('category', 'name slug')
        .populate('brand', 'name slug')
        .sort(buildProductSort(query.sort, hasText))
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      data: items as unknown as ProductCard[],
      meta: {
        ...buildPaginationMeta(total, page, limit),
        facets: { categories: [], brands: [], industries: [] },
      },
    };
  }

  async findByIdForAdmin(id: string): Promise<Record<string, unknown>> {
    const product = await this.productModel
      .findOne({ _id: id, ...notDeleted() })
      .lean()
      .exec();

    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async create(dto: CreateProductDto): Promise<Record<string, unknown>> {
    const categoryPath = await this.resolveCategoryPath(dto.category);
    const slug = await this.ensureUniqueSlug(dto.slug ?? dto.name);
    await this.assertSkuIsFree(dto.sku);

    const created = await this.productModel.create({
      ...dto,
      slug,
      sku: dto.sku.toUpperCase(),
      categoryPath,
      description: sanitizeRichText(dto.description),
    });

    await this.revalidateFor(created);
    return created.toObject() as unknown as Record<string, unknown>;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Record<string, unknown>> {
    const product = await this.productModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!product) throw new NotFoundException('Product not found.');

    const previousSlug = product.slug;
    const previousCategoryPath = [...product.categoryPath];

    if (dto.slug && dto.slug !== product.slug) {
      product.slug = await this.ensureUniqueSlug(dto.slug, id);
    }

    if (dto.sku && dto.sku.toUpperCase() !== product.sku) {
      await this.assertSkuIsFree(dto.sku, id);
      product.sku = dto.sku.toUpperCase();
    }

    // Changing the category is the other path that must recompute
    // categoryPath — the first being a category being re-parented, handled in
    // CategoryService. Missing either one drops the product out of its
    // parent's listing (PROJECT_PLAN.md §7.5).
    if (dto.category && String(dto.category) !== String(product.category)) {
      product.category = new Types.ObjectId(dto.category);
      product.categoryPath = await this.resolveCategoryPath(dto.category);
    }

    if (dto.description !== undefined) {
      product.description = sanitizeRichText(dto.description);
    }

    for (const key of [
      'name',
      'shortDescription',
      'keyFeatures',
      'specifications',
      'images',
      'documents',
      'unit',
      'minOrderQuantity',
      'availability',
      'isActive',
      'isFeatured',
      'isNewArrival',
      'displayOrder',
      'seo',
    ] as const) {
      if (dto[key] !== undefined) {
        (product as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }

    if (dto.brand !== undefined) {
      product.brand = dto.brand ? new Types.ObjectId(dto.brand) : null;
    }

    if (dto.industries !== undefined) {
      product.industries = dto.industries.map((entry) => new Types.ObjectId(entry));
    }

    await product.save();
    await this.revalidateFor(product, { previousSlug, previousCategoryPath });

    return product.toObject() as unknown as Record<string, unknown>;
  }

  /**
   * Soft delete. Deliberately does NOT destroy the product's Cloudinary
   * assets — the action is reversible, and a reconciliation script cleans up
   * genuinely orphaned files (PROJECT_PLAN.md §13.4).
   */
  async remove(id: string): Promise<{ deleted: true }> {
    const product = await this.productModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!product) throw new NotFoundException('Product not found.');

    product.isDeleted = true;
    product.deletedAt = new Date();
    product.isActive = false;
    await product.save();

    await this.revalidateFor(product);
    return { deleted: true };
  }

  async reorderImages(id: string, publicIds: string[]): Promise<Record<string, unknown>> {
    const product = await this.productModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!product) throw new NotFoundException('Product not found.');

    const byPublicId = new Map(product.images.map((image) => [image.publicId, image]));
    const reordered = publicIds
      .map((publicId) => byPublicId.get(publicId))
      .filter((image): image is NonNullable<typeof image> => Boolean(image));

    if (reordered.length !== product.images.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The reorder list must contain every image exactly once.',
      });
    }

    product.images = reordered.map((image, index) => ({ ...image, order: index }));
    await product.save();

    await this.revalidateFor(product);
    return product.toObject() as unknown as Record<string, unknown>;
  }

  /** Removes an image and destroys it in Cloudinary — this one is permanent. */
  async removeImage(id: string, publicId: string): Promise<Record<string, unknown>> {
    const product = await this.productModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!product) throw new NotFoundException('Product not found.');

    const remaining = product.images.filter((image) => image.publicId !== publicId);
    if (remaining.length === product.images.length) {
      throw new NotFoundException('That image is not attached to this product.');
    }

    product.images = remaining.map((image, index) => ({ ...image, order: index }));
    await product.save();

    // After the save: a failed Cloudinary call must not roll back the removal
    // the admin asked for. The service logs and the orphan is reconciled later.
    await this.cloudinary.destroy(publicId);

    await this.revalidateFor(product);
    return product.toObject() as unknown as Record<string, unknown>;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /**
   * Builds `categoryPath` and enforces the leaf-only rule.
   *
   * Products hang off leaves so a parent listing is never a mix of "products
   * filed directly under Welding" and "products in its subcategories" — the
   * counts and the tree stay coherent.
   */
  private async resolveCategoryPath(categoryId: string): Promise<Types.ObjectId[]> {
    const category = await this.categoryModel
      .findOne({ _id: categoryId, ...notDeleted() })
      .select('_id ancestors')
      .lean()
      .exec();

    if (!category) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The selected category does not exist.',
        details: [{ field: 'category', message: 'Unknown category.' }],
      });
    }

    const childCount = await this.categoryModel
      .countDocuments({ parent: category._id, ...notDeleted() })
      .exec();

    if (childCount > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Products must be assigned to a category with no subcategories.',
        details: [{ field: 'category', message: 'Choose a leaf category.' }],
      });
    }

    return [...category.ancestors, category._id];
  }

  private async ensureUniqueSlug(source: string, excludeId?: string): Promise<string> {
    const base = source
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!base) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The name must contain at least one letter or number.',
        details: [{ field: 'name', message: 'Cannot generate a URL from this name.' }],
      });
    }

    const taken = await this.productModel
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
   * Checked here as well as by the unique index, because a SKU collision is a
   * data-entry mistake the client needs to see named — not a raw duplicate-key
   * error. Soft-deleted products still hold their SKU.
   */
  private async assertSkuIsFree(sku: string, excludeId?: string): Promise<void> {
    const existing = await this.productModel
      .findOne({
        sku: sku.toUpperCase().trim(),
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      })
      .select('_id name isDeleted')
      .lean()
      .exec();

    if (existing) {
      throw new BadRequestException({
        code: 'CONFLICT',
        message: existing.isDeleted
          ? `Part number '${sku}' belongs to a deleted product. Restore it or choose another.`
          : `Part number '${sku}' is already used by '${existing.name}'.`,
        details: [{ field: 'sku', message: 'Must be unique.' }],
      });
    }
  }

  /**
   * Purges the pages a product write affects: its own page, the listings of
   * every category in its path, and the home page.
   *
   * `previousCategoryPath` covers a product moving categories — the category
   * it left has to be purged too, or it keeps listing a product that is no
   * longer in it.
   */
  private async revalidateFor(
    product: ProductDocument,
    previous?: { previousSlug?: string; previousCategoryPath?: Types.ObjectId[] },
  ): Promise<void> {
    const affectedCategoryIds = [
      ...product.categoryPath,
      ...(previous?.previousCategoryPath ?? []),
    ];

    const categories = affectedCategoryIds.length
      ? await this.categoryModel
          .find({ _id: { $in: affectedCategoryIds } })
          .select('slug')
          .lean()
          .exec()
      : [];

    const tags = [
      CacheTag.product(product.slug),
      CacheTag.productsList,
      CacheTag.home,
      ...categories.map((category) => CacheTag.category(category.slug)),
    ];

    if (previous?.previousSlug && previous.previousSlug !== product.slug) {
      tags.push(CacheTag.product(previous.previousSlug));
    }

    this.revalidation.revalidate([...new Set(tags)]);
  }

  /** Joins the category and brand names a product card displays. */
  private cardLookupStages(): PipelineStage.FacetPipelineStage[] {
    return [
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, slug: 1 } }],
          as: 'categoryDoc',
        },
      },
      {
        $lookup: {
          from: 'brands',
          localField: 'brand',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, slug: 1 } }],
          as: 'brandDoc',
        },
      },
      { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$brandDoc', preserveNullAndEmptyArrays: true } },
    ] as PipelineStage.FacetPipelineStage[];
  }

  /**
   * Counts documents per value of one dimension.
   *
   * `$unwind` handles both shapes: `categoryPath` and `industries` are arrays,
   * and `brand` is a scalar, which Mongo unwinds as a single-element array.
   * Products with no brand drop out, which is what the facet should show.
   */
  private facetStages(
    match: PipelineStage.FacetPipelineStage[],
    field: string,
  ): PipelineStage.FacetPipelineStage[] {
    return [
      ...match,
      { $unwind: `$${field}` },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ] as PipelineStage.FacetPipelineStage[];
  }

  /**
   * Turns facet ids into `{ slug, name, count }` for the sidebar.
   *
   * Three id→label lookups, one per collection, rather than a `$lookup` inside
   * each facet branch. `$lookup` in a `$facet` runs per bucket and is markedly
   * slower on a shared-CPU tier.
   */
  private async resolveFacetLabels(raw: {
    categories: RawFacet[];
    brands: RawFacet[];
    industries: RawFacet[];
  }): Promise<ProductFacets> {
    const [categories, brands, industries] = await Promise.all([
      this.labelFor(this.categoryModel, raw.categories),
      this.labelFor(this.brands, raw.brands),
      this.labelFor(this.industries, raw.industries),
    ]);

    return { categories, brands, industries };
  }

  private async labelFor(
    source: Model<CategoryDocument> | BrandService | IndustryService,
    buckets: RawFacet[],
  ): Promise<FacetBucket[]> {
    if (!buckets.length) return [];

    const ids = buckets.map((bucket) => bucket._id).filter(Boolean);

    const documents =
      source instanceof BrandService || source instanceof IndustryService
        ? await source
            .findAll({ includeInactive: true })
            .then((entries) =>
              entries
                .filter((entry) => ids.some((id) => String(id) === entry._id))
                .map((entry) => ({ _id: entry._id, name: entry.name, slug: entry.slug })),
            )
        : await source
            .find({ _id: { $in: ids } })
            .select('name slug')
            .lean()
            .exec()
            .then((entries) =>
              entries.map((entry) => ({
                _id: String(entry._id),
                name: entry.name,
                slug: entry.slug,
              })),
            );

    const byId = new Map(documents.map((entry) => [String(entry._id), entry]));

    return buckets
      .map((bucket) => {
        const label = byId.get(String(bucket._id));
        return label ? { slug: label.slug, name: label.name, count: bucket.count } : null;
      })
      .filter((bucket): bucket is FacetBucket => bucket !== null);
  }
}

// ── Aggregation row shapes ────────────────────────────────────────────────

interface RawFacet {
  _id: Types.ObjectId;
  count: number;
}

interface RawCard {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  sku: string;
  shortDescription?: string;
  images?: { url: string; alt: string }[];
  unit: ProductCard['unit'];
  minOrderQuantity: number;
  availability: ProductCard['availability'];
  categoryDoc?: { name: string; slug: string };
  brandDoc?: { name: string; slug: string };
}

function toCard(product: RawCard): ProductCard {
  const image = product.images?.[0];

  return {
    _id: String(product._id),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    shortDescription: product.shortDescription,
    image: image ? { url: image.url, alt: image.alt } : null,
    categoryName: product.categoryDoc?.name ?? '',
    categorySlug: product.categoryDoc?.slug ?? '',
    brandName: product.brandDoc?.name ?? null,
    unit: product.unit,
    minOrderQuantity: product.minOrderQuantity,
    availability: product.availability,
  };
}
